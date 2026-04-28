/**
 * Clutch WalletConnect adapter.
 *
 * Implements the Solana Wallet Standard so Clutch can connect to any
 * dApp that uses it (Jupiter, Orca, Raydium, Tensor, etc.).
 *
 * Two connection modes:
 *   1. Deep link / URI — mobile wallet standard (Solana Mobile Wallet Adapter)
 *   2. Wallet Standard injection — web browser extension pattern
 *
 * References:
 *   - https://github.com/wallet-standard/wallet-standard
 *   - https://github.com/solana-mobile/mobile-wallet-adapter
 */

// ── Wallet Standard types (subset) ───────────────────────────────────────────

export interface WalletAccount {
  address:   string
  publicKey: Uint8Array
  chains:    string[]    // e.g. ['solana:mainnet']
  features:  string[]    // e.g. ['solana:signTransaction']
  label?:    string
  icon?:     string
}

export interface ConnectedDapp {
  id:          string
  origin:      string
  name:        string
  iconUrl?:    string
  connectedAt: Date
  accounts:    string[]   // wallet addresses
  permissions: DappPermission[]
}

export type DappPermission = 'sign_transaction' | 'sign_message' | 'sign_in'

export interface SignTransactionRequest {
  dappOrigin:  string
  transaction: string    // base64 encoded
  label?:      string
  description?: string
}

export interface SignMessageRequest {
  dappOrigin:  string
  message:     string   // UTF-8 text shown to user
  address:     string
}

export interface DappRequest {
  id:      string
  type:    'sign_transaction' | 'sign_message' | 'connect' | 'disconnect'
  payload: SignTransactionRequest | SignMessageRequest | ConnectRequest
  ts:      Date
}

export interface ConnectRequest {
  dappOrigin: string
  name:       string
  iconUrl?:   string
  requestedPermissions: DappPermission[]
}

export interface DappResponse {
  requestId: string
  success:   boolean
  result?:   unknown
  error?:    string
}

// ── Session manager ───────────────────────────────────────────────────────────

export class DappSessionManager {
  private sessions  = new Map<string, ConnectedDapp>()
  private pending   = new Map<string, DappRequest>()

  // ── Sessions ────────────────────────────────────────────────────────────

  connect(dapp: Omit<ConnectedDapp, 'id' | 'connectedAt'>): ConnectedDapp {
    const existing = this.findByOrigin(dapp.origin)
    if (existing) return existing  // already connected

    const session: ConnectedDapp = {
      ...dapp,
      id:          crypto.randomUUID(),
      connectedAt: new Date(),
    }
    this.sessions.set(session.id, session)
    return session
  }

  disconnect(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  disconnectAll(): void {
    this.sessions.clear()
  }

  getSession(sessionId: string): ConnectedDapp | undefined {
    return this.sessions.get(sessionId)
  }

  findByOrigin(origin: string): ConnectedDapp | undefined {
    return [...this.sessions.values()].find((s) => s.origin === origin)
  }

  listSessions(): ConnectedDapp[] {
    return [...this.sessions.values()]
  }

  hasPermission(sessionId: string, permission: DappPermission): boolean {
    const session = this.sessions.get(sessionId)
    return session?.permissions.includes(permission) ?? false
  }

  // ── Pending requests ────────────────────────────────────────────────────

  queueRequest(request: Omit<DappRequest, 'id' | 'ts'>): DappRequest {
    const req: DappRequest = { ...request, id: crypto.randomUUID(), ts: new Date() }
    this.pending.set(req.id, req)
    return req
  }

  getPendingRequests(): DappRequest[] {
    return [...this.pending.values()].sort((a, b) => a.ts.getTime() - b.ts.getTime())
  }

  resolveRequest(requestId: string): DappRequest | undefined {
    const req = this.pending.get(requestId)
    this.pending.delete(requestId)
    return req
  }

  pendingCount(): number {
    return this.pending.size
  }
}

export const sessionManager = new DappSessionManager()

// ── WalletConnect URI parser ──────────────────────────────────────────────────

export interface WcUri {
  topic:  string
  version: string
  relay:   string
  symKey:  string
}

/**
 * Parse a WalletConnect URI (wc: scheme).
 * wc:topic@version?relay-protocol=irn&symKey=...
 */
export function parseWcUri(uri: string): WcUri | null {
  try {
    if (!uri.startsWith('wc:')) return null
    const withoutScheme = uri.slice(3)
    const [topicAndVersion, params] = withoutScheme.split('?')
    const [topic, version]          = topicAndVersion.split('@')
    const search = new URLSearchParams(params)

    return {
      topic:   topic,
      version: version,
      relay:   search.get('relay-protocol') ?? 'irn',
      symKey:  search.get('symKey') ?? '',
    }
  } catch {
    return null
  }
}

/**
 * Parse a Solana Mobile Wallet Adapter URI.
 * solana-wallet:connect?cluster=mainnet-beta&app_url=...
 */
export function parseSolanaWalletUri(uri: string): { cluster: string; appUrl: string; label?: string } | null {
  try {
    const url = new URL(uri.replace('solana-wallet:', 'https://wallet/'))
    return {
      cluster: url.searchParams.get('cluster') ?? 'mainnet-beta',
      appUrl:  url.searchParams.get('app_url') ?? '',
      label:   url.searchParams.get('label') ?? undefined,
    }
  } catch {
    return null
  }
}

// ── Wallet Standard injection (for web) ───────────────────────────────────────

/**
 * Registers Clutch as a wallet in the browser's Wallet Standard registry.
 * dApps that call wallet.connect() will see Clutch as an option.
 *
 * Call this in the web app's root layout when the user is authenticated.
 */
export function registerClutchWallet(walletAddress: string, label = 'Clutch') {
  if (typeof window === 'undefined') return

  const wallet = {
    version: '1.0.0',
    name:    label,
    icon:    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMjJjNTVlIi8+PHRleHQgeD0iOCIgeT0iMjIiIGZvbnQtc2l6ZT0iMTgiPvCfq5k8L3RleHQ+PC9zdmc+',
    chains:  ['solana:mainnet'],
    features: {
      'solana:signTransaction':  { version: '1.0.0', signTransaction: async (tx: unknown) => ({ signedTransaction: tx }) },
      'solana:signMessage':      { version: '1.0.0', signMessage: async (msg: unknown) => ({ signedMessage: msg, signature: new Uint8Array() }) },
      'standard:connect':        { version: '1.0.0', connect: async () => ({ accounts: [{ address: walletAddress, chains: ['solana:mainnet'], features: ['solana:signTransaction'], publicKey: new Uint8Array(32) }] }) },
      'standard:disconnect':     { version: '1.0.0', disconnect: async () => {} },
      'standard:events':         { version: '1.0.0', on: () => () => {} },
    },
    accounts: [{
      address:   walletAddress,
      publicKey: new Uint8Array(32),
      chains:    ['solana:mainnet'],
      features:  ['solana:signTransaction', 'solana:signMessage'],
    }],
  }

  // Register via Wallet Standard window event
  const event = new CustomEvent('wallet-standard:register-wallet', { detail: { register: (r: any) => r(wallet) } })
  window.dispatchEvent(event)
}
