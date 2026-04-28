/**
 * @clutch/anchor — Anchor program interaction layer.
 *
 * Allows Clutch users to interact with any on-chain Anchor program directly
 * from their pocket — reading accounts, calling instructions, parsing events.
 *
 * Key programs pre-integrated:
 *   - Marinade staking program
 *   - Jupiter limit orders
 *   - Drift perpetuals
 *   - Orca Whirlpool (CLMM)
 *   - Raydium AMM
 *   - Metaplex Token Metadata
 *   - SPL Token / Token-2022
 */

// ── IDL types (Anchor standard) ───────────────────────────────────────────────

export interface IdlField {
  name:   string
  type:   IdlType
  docs?:  string[]
}

export type IdlType =
  | 'bool' | 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32'
  | 'u64' | 'i64' | 'u128' | 'i128' | 'f32' | 'f64'
  | 'bytes' | 'string' | 'publicKey'
  | { vec: IdlType }
  | { array: [IdlType, number] }
  | { option: IdlType }
  | { defined: string }

export interface IdlAccountItem {
  name:       string
  isMut:      boolean
  isSigner:   boolean
  isOptional?: boolean
  docs?:       string[]
  pda?:        { seeds: any[] }
}

export interface IdlInstruction {
  name:     string
  docs?:    string[]
  accounts: IdlAccountItem[]
  args:     IdlField[]
}

export interface IdlAccount {
  name:   string
  docs?:  string[]
  type: {
    kind:   'struct'
    fields: IdlField[]
  }
}

export interface IdlError {
  code:    number
  name:    string
  msg:     string
}

export interface AnchorIdl {
  version:      string
  name:         string
  docs?:        string[]
  programId:    string
  instructions: IdlInstruction[]
  accounts?:    IdlAccount[]
  types?:       IdlAccount[]
  errors?:      IdlError[]
  events?:      Array<{ name: string; fields: IdlField[] }>
  metadata?: {
    address:    string
    origin?:    string
    deployedAt?: string
  }
}

// ── Known programs ────────────────────────────────────────────────────────────

export interface KnownProgram {
  name:        string
  programId:   string
  description: string
  category:    'defi' | 'nft' | 'staking' | 'governance' | 'token' | 'infra'
  docsUrl?:    string
  idlUrl?:     string
  logoUrl?:    string
}

export const KNOWN_PROGRAMS: KnownProgram[] = [
  {
    name:        'Marinade Staking',
    programId:   'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    description: 'Liquid staking — stake SOL for mSOL',
    category:    'staking',
    docsUrl:     'https://docs.marinade.finance',
  },
  {
    name:        'Jupiter Limit Order',
    programId:   'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu',
    description: 'Place limit orders across any DEX',
    category:    'defi',
    docsUrl:     'https://docs.jup.ag/limit-order',
  },
  {
    name:        'Drift Protocol',
    programId:   'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
    description: 'Perpetual futures and spot margin',
    category:    'defi',
    docsUrl:     'https://docs.drift.trade',
  },
  {
    name:        'Orca Whirlpool',
    programId:   'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    description: 'Concentrated liquidity AMM',
    category:    'defi',
    docsUrl:     'https://orca-so.gitbook.io/orca-developer-portal',
  },
  {
    name:        'Raydium AMM v4',
    programId:   '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    description: 'Automated market maker + liquidity pools',
    category:    'defi',
    docsUrl:     'https://docs.raydium.io',
  },
  {
    name:        'Metaplex Token Metadata',
    programId:   'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
    description: 'NFT minting and metadata standard',
    category:    'nft',
    docsUrl:     'https://developers.metaplex.com',
  },
  {
    name:        'SPL Token Program',
    programId:   'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    description: 'Core Solana token standard',
    category:    'token',
    docsUrl:     'https://spl.solana.com/token',
  },
  {
    name:        'Token-2022',
    programId:   'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    description: 'Next-gen token extensions (transfer fees, confidential)',
    category:    'token',
    docsUrl:     'https://spl.solana.com/token-2022',
  },
  {
    name:        'SPL Governance',
    programId:   'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
    description: 'Realms DAO governance program',
    category:    'governance',
    docsUrl:     'https://docs.realms.today',
  },
  {
    name:        'Jito Restaking',
    programId:   'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Poqu',
    description: 'Stake SOL for jitoSOL + MEV rewards',
    category:    'staking',
    docsUrl:     'https://jito.network',
  },
  {
    name:        'Mango Markets v4',
    programId:   '4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg',
    description: 'Cross-margined DeFi trading',
    category:    'defi',
    docsUrl:     'https://docs.mango.markets',
  },
  {
    name:        'Kamino Lending',
    programId:   'KLend2g3cP87fffoy8q1mQqGKjrL1AyR9UZKKZnJbCeH5o',
    description: 'Lending + borrowing protocol',
    category:    'defi',
    docsUrl:     'https://docs.kamino.finance',
  },
]

// ── IDL fetcher ────────────────────────────────────────────────────────────────

const IDL_CACHE = new Map<string, { idl: AnchorIdl; ts: number }>()
const IDL_CACHE_TTL = 30 * 60 * 1000  // 30 min

/**
 * Fetch an Anchor IDL from the on-chain IDL account or Anchor registry.
 *
 * Sources (tried in order):
 *   1. Anchor IDL registry at https://api.apr.dev/idl/<programId>
 *   2. On-chain idl account at PDA [Buffer.from('anchor:idl'), programId]
 */
export async function fetchIdl(programId: string, rpcUrl: string): Promise<AnchorIdl | null> {
  const cached = IDL_CACHE.get(programId)
  if (cached && Date.now() - cached.ts < IDL_CACHE_TTL) return cached.idl

  // Try Anchor IDL registry first
  try {
    const res = await fetch(`https://api.apr.dev/idl/${programId}`, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const idl = await res.json() as AnchorIdl
      IDL_CACHE.set(programId, { idl, ts: Date.now() })
      return idl
    }
  } catch { /* fallback */ }

  // Try on-chain IDL account
  try {
    const idlAddress = await deriveIdlAddress(programId)
    const res = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method:  'getAccountInfo',
        params:  [idlAddress, { encoding: 'base64' }],
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (res.ok) {
      const data = await res.json() as any
      const base64 = data.result?.value?.data?.[0]
      if (base64) {
        const bytes = Buffer.from(base64, 'base64')
        // Skip 8-byte discriminator
        const idlBytes = bytes.slice(8)
        const idl = JSON.parse(idlBytes.toString('utf8').replace(/\0/g, '')) as AnchorIdl
        IDL_CACHE.set(programId, { idl, ts: Date.now() })
        return idl
      }
    }
  } catch { /* no IDL found */ }

  return null
}

/**
 * Derive the canonical IDL account address for a program.
 * PDA: ['anchor:idl', programId]
 */
async function deriveIdlAddress(programId: string): Promise<string> {
  // Full impl: PublicKey.findProgramAddressSync([Buffer.from('anchor:idl'), programKey.toBuffer()], programKey)
  // Stub — returns placeholder
  return `IDL_PDA_${programId.slice(0, 8)}`
}

// ── Account decoder ───────────────────────────────────────────────────────────

/**
 * Decode a raw account buffer using an IDL account definition.
 * Strips the 8-byte Anchor discriminator, then deserialises fields.
 *
 * Full impl uses @coral-xyz/borsh for deserialisation.
 */
export function decodeAccount(
  data:    Buffer,
  account: IdlAccount,
): Record<string, unknown> | null {
  if (data.length < 8) return null

  // Skip 8-byte discriminator
  const payload = data.slice(8)

  // Stub — in production use @coral-xyz/borsh or anchor's BorshCoder
  return {
    _raw:    payload.toString('hex').slice(0, 64) + '...',
    _fields: account.type.fields.map(f => f.name),
    _note:   'Wire @coral-xyz/anchor BorshCoder for full deserialisation',
  }
}

// ── Instruction builder ───────────────────────────────────────────────────────

export interface InstructionCallParams {
  programId:   string
  instruction: IdlInstruction
  args:        Record<string, unknown>
  accounts:    Record<string, string>  // name → public key address
}

/**
 * Build a Solana instruction from an IDL instruction definition and args.
 * Returns base64-encoded instruction for the client to include in a transaction.
 *
 * Full impl: use @coral-xyz/anchor Program.instruction.<name>() 
 */
export function buildInstruction(params: InstructionCallParams): string {
  console.warn('[anchor] buildInstruction: stub — wire @coral-xyz/anchor for production')
  return 'BASE64_INSTRUCTION_PLACEHOLDER'
}
