/**
 * Squads Protocol integration — Solana on-chain multisig.
 * Squads is the dominant multisig program on Solana (used by most Solana DAOs + protocols).
 *
 * Docs: https://docs.squads.so/main/technical-documentation/sdk
 *
 * This module provides:
 *   - Create a Squad (on-chain multisig account)
 *   - Create a transaction proposal
 *   - Approve / execute a Squad transaction
 *
 * Note: Squads SDK (@sqds/multisig) must be installed.
 * The functions below are typed stubs that show the full integration shape —
 * wire the SDK calls in when deploying to mainnet.
 */

import { ChainId } from '@clutch/core'

export interface SquadsConfig {
  rpcUrl:       string
  programId?:   string   // defaults to Squads V4 mainnet program
}

export interface CreateSquadParams {
  /** Members with their voting weights */
  members:      Array<{ address: string; permissions: number }>
  /** M-of-N threshold */
  threshold:    number
  /** Human-readable name stored in memo */
  name:         string
  /** Payer public key */
  creator:      string
}

export interface SquadInfo {
  address:      string   // multisig account address
  threshold:    number
  memberCount:  number
  transactionIndex: number
}

export interface SquadProposal {
  multisigAddress:  string
  transactionIndex: number
  status:           'active' | 'approved' | 'rejected' | 'cancelled' | 'executed'
  approvedBy:       string[]
  rejectedBy:       string[]
}

export class SquadsClient {
  constructor(private config: SquadsConfig) {}

  /**
   * Create a new Squads multisig account on Solana.
   * Returns the multisig account address and the unsigned create transaction.
   *
   * In production:
   *   import * as multisig from '@sqds/multisig'
   *   const [multisigPda] = multisig.getMultisigPda({ createKey })
   *   const ix = await multisig.instructions.multisigCreateV2({ ... })
   */
  async createSquad(params: CreateSquadParams): Promise<{
    multisigAddress: string
    transaction:     string   // base64 serialised transaction to sign + send
  }> {
    // Stub — returns placeholder until @sqds/multisig is installed
    console.warn('[squads] createSquad: stub implementation — wire @sqds/multisig SDK for production')
    return {
      multisigAddress: 'SQUAD_ADDRESS_PLACEHOLDER',
      transaction:     'BASE64_TX_PLACEHOLDER',
    }
  }

  /**
   * Fetch info about an existing Squad.
   */
  async getSquadInfo(multisigAddress: string): Promise<SquadInfo | null> {
    try {
      const res = await fetch(this.config.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'getAccountInfo',
          params:  [multisigAddress, { encoding: 'base64' }],
        }),
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json()
      if (!data.result?.value) return null
      // Decode account data using @sqds/multisig in production
      return { address: multisigAddress, threshold: 2, memberCount: 3, transactionIndex: 0 }
    } catch {
      return null
    }
  }

  /**
   * Propose a Solana transaction through Squads.
   * Creates a VaultTransaction proposal that members can approve.
   */
  async proposeTransaction(params: {
    multisigAddress: string
    proposer:        string
    instructions:    unknown[]   // TransactionInstruction[]
    memo?:           string
  }): Promise<{ transactionIndex: number; transaction: string }> {
    console.warn('[squads] proposeTransaction: stub — wire @sqds/multisig SDK')
    return { transactionIndex: 1, transaction: 'BASE64_TX_PLACEHOLDER' }
  }

  /**
   * Approve a pending Squad proposal.
   * Returns the approve instruction transaction.
   */
  async approveProposal(params: {
    multisigAddress:  string
    transactionIndex: number
    approver:         string
  }): Promise<string> {
    console.warn('[squads] approveProposal: stub — wire @sqds/multisig SDK')
    return 'BASE64_APPROVE_TX_PLACEHOLDER'
  }

  /**
   * Execute an approved Squad proposal (once threshold is met).
   */
  async executeProposal(params: {
    multisigAddress:  string
    transactionIndex: number
    executor:         string
  }): Promise<string> {
    console.warn('[squads] executeProposal: stub — wire @sqds/multisig SDK')
    return 'BASE64_EXECUTE_TX_PLACEHOLDER'
  }
}

export function createSquadsClient(rpcUrl: string): SquadsClient {
  return new SquadsClient({ rpcUrl })
}
