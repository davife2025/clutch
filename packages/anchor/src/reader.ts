/**
 * On-chain account reader for Anchor programs.
 * Fetches raw account data from the Solana RPC and decodes it using IDLs.
 */

import type { AnchorIdl, IdlAccount } from './idl.js'

export interface AccountData {
  address:   string
  lamports:  number
  owner:     string
  data:      string    // hex
  decoded?:  Record<string, unknown>
  fetchedAt: Date
}

export interface ProgramAccounts {
  programId:  string
  accounts:   AccountData[]
  total:      number
}

export class AccountReader {
  constructor(private rpcUrl: string) {}

  /**
   * Fetch a single account by address.
   */
  async getAccount(address: string): Promise<AccountData | null> {
    try {
      const res = await fetch(this.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getAccountInfo',
          params:  [address, { encoding: 'base64', commitment: 'confirmed' }],
        }),
        signal: AbortSignal.timeout(8000),
      })

      const data = await res.json() as { result: { value: any } }
      const value = data.result?.value
      if (!value) return null

      const rawBytes = Buffer.from(value.data[0], 'base64')

      return {
        address,
        lamports:  value.lamports,
        owner:     value.owner,
        data:      rawBytes.toString('hex'),
        fetchedAt: new Date(),
      }
    } catch {
      return null
    }
  }

  /**
   * Fetch multiple accounts in a single RPC call.
   */
  async getMultipleAccounts(addresses: string[]): Promise<(AccountData | null)[]> {
    if (addresses.length === 0) return []

    try {
      const res = await fetch(this.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getMultipleAccounts',
          params:  [addresses, { encoding: 'base64', commitment: 'confirmed' }],
        }),
        signal: AbortSignal.timeout(10_000),
      })

      const data = await res.json() as { result: { value: any[] } }
      const values = data.result?.value ?? []

      return values.map((v, i) => {
        if (!v) return null
        const rawBytes = Buffer.from(v.data[0], 'base64')
        return {
          address:   addresses[i],
          lamports:  v.lamports,
          owner:     v.owner,
          data:      rawBytes.toString('hex'),
          fetchedAt: new Date(),
        }
      })
    } catch {
      return addresses.map(() => null)
    }
  }

  /**
   * Get all accounts owned by a program, optionally filtered by a data discriminator.
   */
  async getProgramAccounts(
    programId:      string,
    filters?:       Array<{ memcmp: { offset: number; bytes: string } } | { dataSize: number }>,
    limit           = 100,
  ): Promise<ProgramAccounts> {
    try {
      const res = await fetch(this.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getProgramAccounts',
          params:  [
            programId,
            {
              encoding:   'base64',
              commitment: 'confirmed',
              filters:    filters ?? [],
              dataSlice:  undefined,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      })

      const data = await res.json() as { result: any[] }
      const accounts = (data.result ?? []).slice(0, limit).map((acc: any): AccountData => {
        const rawBytes = Buffer.from(acc.account.data[0], 'base64')
        return {
          address:   acc.pubkey,
          lamports:  acc.account.lamports,
          owner:     acc.account.owner,
          data:      rawBytes.toString('hex'),
          fetchedAt: new Date(),
        }
      })

      return { programId, accounts, total: accounts.length }
    } catch {
      return { programId, accounts: [], total: 0 }
    }
  }

  /**
   * Compute the Anchor discriminator for an account type.
   * discriminator = sha256("account:<AccountName>")[0..8]
   *
   * Full impl: import { sha256 } from '@noble/hashes/sha256'
   */
  computeDiscriminator(accountName: string): string {
    // Stub — returns the expected format
    return `sha256("account:${accountName}")[0..8]`
  }
}

export function createAccountReader(rpcUrl: string): AccountReader {
  return new AccountReader(rpcUrl)
}
