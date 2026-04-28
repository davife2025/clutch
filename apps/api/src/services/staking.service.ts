/**
 * Solana staking service.
 *
 * Supports:
 *   - Native SOL staking (Solana stake accounts)
 *   - Liquid staking: Marinade (mSOL), Jito (jitoSOL), Lido (stSOL)
 *   - Validator discovery + stats
 */

import { lamportsToSol } from '@clutch/core'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Validator {
  voteAccount:    string
  name:           string
  commission:     number    // %
  activatedStake: bigint    // lamports
  apy:            number    // %
  delinquent:     boolean
  datacenter?:    string
  website?:       string
  iconUrl?:       string
}

export interface StakeAccount {
  address:        string
  owner:          string
  voter:          string     // vote account of validator
  stake:          bigint     // lamports
  activationEpoch: number
  deactivationEpoch?: number
  state:          'active' | 'activating' | 'deactivating' | 'inactive'
  rewards?:       bigint     // estimated pending rewards
}

export interface LiquidStakeOption {
  protocol:    string
  token:       string       // 'mSOL' | 'jitoSOL' | 'stSOL'
  mintAddress: string
  apy:         number
  tvlSOL:      number
  depositUrl:  string
  /** Exchange rate: 1 liquid token = X SOL */
  exchangeRate: number
}

export interface StakingPortfolio {
  walletAddress:       string
  nativeStakeAccounts: StakeAccount[]
  totalNativeStakedSOL: number
  estimatedYearlyRewardSOL: number
  liquidPositions:     Array<{ token: string; amount: number; valueSOL: number }>
  totalLiquidSOL:      number
  combinedApy:         number
}

// ── Validator registry ────────────────────────────────────────────────────────

const VALIDATOR_CACHE: { data: Validator[]; ts: number } = { data: [], ts: 0 }
const VALIDATOR_CACHE_TTL = 15 * 60 * 1000

export class StakingService {
  constructor(private rpcUrl: string) {}

  // ── Validators ────────────────────────────────────────────────────────────

  async getTopValidators(limit = 20): Promise<Validator[]> {
    if (VALIDATOR_CACHE.data.length > 0 && Date.now() - VALIDATOR_CACHE.ts < VALIDATOR_CACHE_TTL) {
      return VALIDATOR_CACHE.data.slice(0, limit)
    }

    try {
      // Fetch from Solana Beach (public validator API)
      const res = await fetch(
        `https://api.solanabeach.io/v1/validators?limit=${limit}&sort=activatedStake`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
      )

      if (res.ok) {
        const data = await res.json() as any[]
        const validators: Validator[] = data.map((v: any) => ({
          voteAccount:    v.pubkey ?? v.votePubkey,
          name:           v.name ?? v.moniker ?? v.pubkey?.slice(0, 8),
          commission:     v.commission ?? 0,
          activatedStake: BigInt(v.activatedStake ?? 0),
          apy:            v.apy ?? 6.5,
          delinquent:     v.delinquent ?? false,
          datacenter:     v.datacenterKey ?? undefined,
          website:        v.website ?? undefined,
          iconUrl:        v.iconUrl ?? undefined,
        }))
        VALIDATOR_CACHE.data = validators
        VALIDATOR_CACHE.ts   = Date.now()
        return validators.slice(0, limit)
      }
    } catch { /* fallback */ }

    // Fallback: fetch from RPC
    return this.getValidatorsFromRpc(limit)
  }

  private async getValidatorsFromRpc(limit: number): Promise<Validator[]> {
    try {
      const res = await fetch(this.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getVoteAccounts',
          params:  [{ commitment: 'confirmed' }],
        }),
        signal: AbortSignal.timeout(10_000),
      })

      const data = await res.json() as { result: { current: any[]; delinquent: any[] } }
      const current = data.result?.current ?? []

      return current
        .sort((a, b) => Number(BigInt(b.activatedStake ?? 0) - BigInt(a.activatedStake ?? 0)))
        .slice(0, limit)
        .map((v: any): Validator => ({
          voteAccount:    v.votePubkey,
          name:           v.votePubkey.slice(0, 8),
          commission:     v.commission ?? 0,
          activatedStake: BigInt(v.activatedStake ?? 0),
          apy:            6.5 - (v.commission ?? 0) * 0.065,  // rough estimate
          delinquent:     false,
        }))
    } catch {
      return []
    }
  }

  // ── Stake accounts ────────────────────────────────────────────────────────

  async getStakeAccounts(ownerAddress: string): Promise<StakeAccount[]> {
    try {
      const res = await fetch(this.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getProgramAccounts',
          params:  [
            'Stake11111111111111111111111111111111111111112',
            {
              commitment: 'confirmed',
              filters: [
                { memcmp: { offset: 44, bytes: ownerAddress } },
              ],
              encoding: 'jsonParsed',
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      })

      const data = await res.json() as { result: any[] }
      const accounts = data.result ?? []

      return accounts.map((acc: any): StakeAccount => {
        const info        = acc.account?.data?.parsed?.info
        const stake       = info?.stake
        const delegation  = stake?.delegation
        const meta        = info?.meta

        return {
          address:          acc.pubkey,
          owner:            meta?.authorized?.staker ?? ownerAddress,
          voter:            delegation?.voter ?? '',
          stake:            BigInt(delegation?.stake ?? 0),
          activationEpoch:  Number(delegation?.activationEpoch ?? 0),
          deactivationEpoch: delegation?.deactivationEpoch !== '18446744073709551615'
            ? Number(delegation?.deactivationEpoch ?? 0)
            : undefined,
          state: this.deriveStakeState(delegation),
        }
      }).filter((a) => a.stake > BigInt(0))
    } catch {
      return []
    }
  }

  private deriveStakeState(delegation: any): StakeAccount['state'] {
    if (!delegation) return 'inactive'
    const MAX_EPOCH = '18446744073709551615'
    if (delegation.deactivationEpoch !== MAX_EPOCH) return 'deactivating'
    if (delegation.activationEpoch === '0') return 'active'
    return 'activating'
  }

  // ── Liquid staking options ────────────────────────────────────────────────

  async getLiquidStakingOptions(): Promise<LiquidStakeOption[]> {
    const [marinade, jito] = await Promise.allSettled([
      this.fetchMarinadeStats(),
      this.fetchJitoStats(),
    ])

    const options: LiquidStakeOption[] = []

    if (marinade.status === 'fulfilled') options.push(marinade.value)
    else options.push(this.marinadeDefault())

    if (jito.status === 'fulfilled') options.push(jito.value)
    else options.push(this.jitoDefault())

    // Lido stSOL (hardcoded since API is deprecated)
    options.push({
      protocol:     'Lido',
      token:        'stSOL',
      mintAddress:  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
      apy:          6.8,
      tvlSOL:       7_500_000,
      depositUrl:   'https://solana.lido.fi',
      exchangeRate: 1.068,
    })

    return options
  }

  private async fetchMarinadeStats(): Promise<LiquidStakeOption> {
    const res = await fetch('https://api.marinade.finance/msol/apy/1d', {
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return this.marinadeDefault()
    const data = await res.json() as { value: number }
    return {
      protocol:     'Marinade Finance',
      token:        'mSOL',
      mintAddress:  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
      apy:          (data.value ?? 0.068) * 100,
      tvlSOL:       15_000_000,
      depositUrl:   'https://marinade.finance',
      exchangeRate: 1.0 + ((data.value ?? 0.068)),
    }
  }

  private marinadeDefault(): LiquidStakeOption {
    return { protocol: 'Marinade Finance', token: 'mSOL', mintAddress: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', apy: 6.8, tvlSOL: 15_000_000, depositUrl: 'https://marinade.finance', exchangeRate: 1.068 }
  }

  private async fetchJitoStats(): Promise<LiquidStakeOption> {
    const res = await fetch('https://kobe.mainnet.jito.network/api/v1/apy', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return this.jitoDefault()
    const data = await res.json() as { apy: number }
    return {
      protocol:     'Jito',
      token:        'jitoSOL',
      mintAddress:  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      apy:          (data.apy ?? 0.078) * 100,
      tvlSOL:       10_000_000,
      depositUrl:   'https://jito.network',
      exchangeRate: 1.0 + ((data.apy ?? 0.078)),
    }
  }

  private jitoDefault(): LiquidStakeOption {
    return { protocol: 'Jito', token: 'jitoSOL', mintAddress: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', apy: 7.8, tvlSOL: 10_000_000, depositUrl: 'https://jito.network', exchangeRate: 1.078 }
  }

  // ── Portfolio ─────────────────────────────────────────────────────────────

  async buildStakingPortfolio(
    walletAddress: string,
    tokenBalances: Record<string, number>,
    solPriceUsd: number,
  ): Promise<StakingPortfolio> {
    const [stakeAccounts, liquidOptions] = await Promise.all([
      this.getStakeAccounts(walletAddress),
      this.getLiquidStakingOptions(),
    ])

    const totalNativeStakedSOL = stakeAccounts.reduce(
      (s, a) => s + Number(lamportsToSol(a.stake)), 0
    )

    const avgApy = stakeAccounts.length > 0 ? 6.5 : 0
    const estimatedYearlyRewardSOL = totalNativeStakedSOL * (avgApy / 100)

    // Find liquid positions from wallet balances
    const liquidPositions = liquidOptions
      .filter(opt => tokenBalances[opt.token] && tokenBalances[opt.token] > 0)
      .map(opt => ({
        token:    opt.token,
        amount:   tokenBalances[opt.token],
        valueSOL: tokenBalances[opt.token] * opt.exchangeRate,
      }))

    const totalLiquidSOL = liquidPositions.reduce((s, p) => s + p.valueSOL, 0)
    const totalStakedSOL = totalNativeStakedSOL + totalLiquidSOL
    const combinedApy    = totalStakedSOL > 0
      ? (totalNativeStakedSOL * avgApy + totalLiquidSOL * 7.0) / totalStakedSOL
      : 0

    return {
      walletAddress,
      nativeStakeAccounts: stakeAccounts,
      totalNativeStakedSOL,
      estimatedYearlyRewardSOL,
      liquidPositions,
      totalLiquidSOL,
      combinedApy,
    }
  }
}
