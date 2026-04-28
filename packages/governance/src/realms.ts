/**
 * Realms governance client.
 *
 * Realms is the primary DAO governance platform on Solana.
 * Used by: Mango, Marinade, Jupiter, Drift, Helium, Bonk, and hundreds more.
 *
 * APIs:
 *   - Realms API v0  https://api.realms.today
 *   - On-chain via RPC (SPL Governance program)
 *
 * SPL Governance program: GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw
 */

import type {
  Realm, GovernanceProposal, TokenOwnerRecord,
  VoteRecord, VotingPower, ProposalState,
} from './types.js'

const REALMS_API   = 'https://api.realms.today/api'
const SPL_GOV_PROG = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'

// Caches
const realmCache    = new Map<string, { data: Realm; ts: number }>()
const proposalCache = new Map<string, { data: GovernanceProposal[]; ts: number }>()
const CACHE_TTL     = 2 * 60 * 1000   // 2 minutes — proposals change fast during voting

export class RealmsClient {
  constructor(private rpcUrl: string) {}

  // ── Realms ────────────────────────────────────────────────────────────────

  /**
   * Fetch a realm by its address.
   */
  async getRealm(realmAddress: string): Promise<Realm | null> {
    const cached = realmCache.get(realmAddress)
    if (cached && Date.now() - cached.ts < CACHE_TTL * 5) return cached.data

    try {
      const res = await fetch(`${REALMS_API}/realm/${realmAddress}`, {
        headers: { Accept: 'application/json' },
        signal:  AbortSignal.timeout(6000),
      })
      if (!res.ok) return null
      const data = await res.json() as any

      const realm: Realm = {
        address:          realmAddress,
        name:             data.name ?? realmAddress.slice(0, 8),
        communityMint:    data.communityMint ?? '',
        councilMint:      data.councilMint ?? undefined,
        minCommunityTokensToCreateGovernance: data.minCommunityTokensToCreateGovernance ?? '0',
        votingProposalCount: data.votingProposalCount ?? 0,
        iconUrl:          data.ogImage ?? data.iconUrl ?? undefined,
        description:      data.about ?? undefined,
        website:          data.website ?? undefined,
        twitter:          data.twitter ? `https://twitter.com/${data.twitter}` : undefined,
        discord:          data.discord ?? undefined,
      }

      realmCache.set(realmAddress, { data: realm, ts: Date.now() })
      return realm
    } catch {
      return null
    }
  }

  /**
   * Search realms by name — returns top matches.
   */
  async searchRealms(query: string, limit = 10): Promise<Realm[]> {
    try {
      const res = await fetch(
        `${REALMS_API}/realm?search=${encodeURIComponent(query)}&limit=${limit}`,
        { signal: AbortSignal.timeout(6000) }
      )
      if (!res.ok) return []
      const data = await res.json() as any[]
      return (data ?? []).map((r: any): Realm => ({
        address:          r.realmId ?? r.address,
        name:             r.name ?? r.displayName,
        communityMint:    r.communityMint ?? '',
        votingProposalCount: r.activeProposalCount ?? 0,
        iconUrl:          r.ogImage ?? undefined,
        description:      r.about ?? undefined,
      }))
    } catch {
      return []
    }
  }

  /**
   * Get well-known Solana DAOs.
   */
  async getFeaturedRealms(): Promise<Realm[]> {
    // Top Solana DAOs by governance activity
    const FEATURED = [
      { address: 'DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE', name: 'Mango DAO' },
      { address: 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5iovmiBR1bEUSRUT', name: 'Marinade DAO' },
      { address: 'GDuUFXEhUm4jG71vPxYRX7BKXZK49pEBcP2vNN14QXMR', name: 'Jupiter DAO' },
      { address: 'BondMdXbpqRKpWCFeFhc4e3b2GDEYhHoMgk2o3A4JNiy', name: 'Bonk DAO' },
      { address: 'DdoPp2BBOH4oNDWo1KVTS3BSumSFerZ2RFwBrm2rtzCe', name: 'Drift DAO' },
    ]

    const results = await Promise.allSettled(
      FEATURED.map((f) => this.getRealm(f.address).then(r => r ?? { ...f, communityMint: '', votingProposalCount: 0 }))
    )

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Realm>).value)
  }

  // ── Proposals ─────────────────────────────────────────────────────────────

  /**
   * Get active (voting) proposals for a realm.
   */
  async getActiveProposals(realmAddress: string): Promise<GovernanceProposal[]> {
    return this.getProposals(realmAddress, ['Voting', 'Succeeded'])
  }

  /**
   * Get proposals filtered by state.
   */
  async getProposals(
    realmAddress: string,
    states?: ProposalState[],
  ): Promise<GovernanceProposal[]> {
    const cacheKey = `${realmAddress}:${(states ?? []).join(',')}`
    const cached   = proposalCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    try {
      const params = new URLSearchParams({ realm: realmAddress })
      if (states?.length) params.set('state', states.join(','))

      const res = await fetch(`${REALMS_API}/proposal?${params}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const data = await res.json() as any[]

      const proposals: GovernanceProposal[] = (data ?? []).map((p: any): GovernanceProposal => ({
        address:           p.pubkey ?? p.address,
        realmAddress,
        governanceAddress: p.governance ?? '',
        name:              p.name ?? 'Unnamed proposal',
        description:       p.description ?? undefined,
        descriptionLink:   p.descriptionLink ?? undefined,
        state:             p.state ?? 'Draft',
        voteType:          p.voteType ?? 'SingleChoice',
        draftAt:           p.draftAt ?? 0,
        votingAt:          p.votingAt ?? undefined,
        votingCompletedAt: p.votingCompletedAt ?? undefined,
        yesVoteCount:      p.yesVoteCount ?? '0',
        noVoteCount:       p.noVoteCount ?? '0',
        abstainVoteCount:  p.abstainVoteCount ?? undefined,
        proposalOwner:     p.tokenOwnerRecord ?? '',
        maxVotingTime:     p.maxVotingTime ?? 259200,
        startVotingAt:     p.startVotingAt ?? undefined,
        executionFlags:    p.executionFlags ?? 0,
      }))

      proposalCache.set(cacheKey, { data: proposals, ts: Date.now() })
      return proposals
    } catch {
      return []
    }
  }

  // ── Token owner records (voting power) ───────────────────────────────────

  /**
   * Get voting power for a wallet in a realm.
   */
  async getVotingPower(
    walletAddress: string,
    realmAddress:  string,
  ): Promise<VotingPower> {
    try {
      const res = await fetch(
        `${REALMS_API}/token-owner-record?realm=${realmAddress}&owner=${walletAddress}`,
        { signal: AbortSignal.timeout(6000) }
      )

      if (!res.ok) {
        return { realmAddress, communityPower: '0', canVote: false, canCreateProposal: false }
      }

      const data = await res.json() as any
      const communityPower = data?.governingTokenDepositAmount ?? '0'
      const canVote        = BigInt(communityPower) > BigInt(0)

      return {
        realmAddress,
        communityPower,
        councilPower: data?.councilPower ?? undefined,
        canVote,
        canCreateProposal: canVote,
      }
    } catch {
      return { realmAddress, communityPower: '0', canVote: false, canCreateProposal: false }
    }
  }

  /**
   * Get all realms where a wallet holds voting power.
   */
  async getWalletRealms(walletAddress: string): Promise<Array<{ realm: Realm; power: VotingPower }>> {
    try {
      const res = await fetch(
        `${REALMS_API}/token-owner-record?owner=${walletAddress}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return []

      const records = await res.json() as any[]
      const results = await Promise.allSettled(
        (records ?? []).map(async (rec: any) => {
          const realm = await this.getRealm(rec.realm ?? rec.realmId)
          if (!realm) return null
          return {
            realm,
            power: {
              realmAddress:   realm.address,
              communityPower: rec.governingTokenDepositAmount ?? '0',
              canVote:        BigInt(rec.governingTokenDepositAmount ?? '0') > BigInt(0),
              canCreateProposal: BigInt(rec.governingTokenDepositAmount ?? '0') > BigInt(0),
            } as VotingPower,
          }
        })
      )

      return results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<any>).value)
    } catch {
      return []
    }
  }

  // ── Voting ────────────────────────────────────────────────────────────────

  /**
   * Build a cast-vote transaction for Realms.
   * Returns base64 transaction for the client to sign.
   *
   * Full implementation uses @solana/spl-governance:
   *   import { withCastVote, Vote, YesNoVote } from '@solana/spl-governance'
   */
  async buildCastVoteTx(params: {
    realmAddress:     string
    proposalAddress:  string
    voterAddress:     string
    vote:             'Yes' | 'No' | 'Abstain'
  }): Promise<string> {
    console.warn('[governance] buildCastVoteTx: stub — wire @solana/spl-governance SDK for mainnet')
    return 'BASE64_VOTE_TX_PLACEHOLDER'
  }
}

export function createRealmsClient(rpcUrl: string): RealmsClient {
  return new RealmsClient(rpcUrl)
}
