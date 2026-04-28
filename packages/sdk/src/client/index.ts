/**
 * Clutch SDK — ClutchClient
 *
 * A fully-typed HTTP client for the Clutch API.
 * Handles auth, retries, and response normalisation.
 *
 * Usage:
 *   const clutch = new ClutchClient({ apiUrl: 'https://api.clutch.app', token: 'jwt...' })
 *   const pockets = await clutch.pockets.list()
 *   const quote   = await clutch.defi.getQuote({ from: 'SOL', to: 'USDC', amount: 1 })
 */

import type {
  Pocket, Wallet, Transaction, WalletBalance,
  PaymentIntent, PaymentResult, ChainId,
} from '@clutch/core'

export interface ClutchClientConfig {
  apiUrl:    string
  token?:    string
  /** Called when token expires — return new token or null to abort */
  onTokenRefresh?: () => Promise<string | null>
  timeout?:  number   // ms, default 10_000
  retries?:  number   // default 2
}

export class ClutchClient {
  private config: Required<ClutchClientConfig>

  constructor(config: ClutchClientConfig) {
    this.config = {
      token:           config.token ?? '',
      onTokenRefresh:  config.onTokenRefresh ?? (() => Promise.resolve(null)),
      timeout:         config.timeout  ?? 10_000,
      retries:         config.retries  ?? 2,
      ...config,
    }
  }

  // ── Token management ──────────────────────────────────────────────────────

  setToken(token: string): void {
    this.config.token = token
  }

  getToken(): string {
    return this.config.token
  }

  // ── Core HTTP ─────────────────────────────────────────────────────────────

  private async request<T>(
    method:  string,
    path:    string,
    body?:   unknown,
    attempt = 0,
  ): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {}),
      },
      body:   body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout),
    })

    if (res.status === 401 && attempt < this.config.retries) {
      const newToken = await this.config.onTokenRefresh()
      if (newToken) {
        this.setToken(newToken)
        return this.request<T>(method, path, body, attempt + 1)
      }
    }

    const json = await res.json()

    if (!res.ok) {
      throw new ClutchError(
        json.error?.message ?? `HTTP ${res.status}`,
        json.error?.code    ?? 'API_ERROR',
        res.status,
      )
    }

    return json.data as T
  }

  private get  = <T>(path: string)                   => this.request<T>('GET',    path)
  private post = <T>(path: string, body?: unknown)   => this.request<T>('POST',   path, body)
  private del  = <T>(path: string)                   => this.request<T>('DELETE', path)
  private patch = <T>(path: string, body?: unknown)  => this.request<T>('PATCH',  path, body)

  // ── Auth ──────────────────────────────────────────────────────────────────

  auth = {
    login: (email: string, password: string) =>
      this.post<{ token: string; userId: string }>('/auth/login', { email, password }),

    register: (email: string, password: string) =>
      this.post<{ token: string; userId: string }>('/auth/register', { email, password }),
  }

  // ── Pockets ───────────────────────────────────────────────────────────────

  pockets = {
    list: () =>
      this.get<{ pockets: Pocket[] }>('/pockets'),

    get: (id: string) =>
      this.get<{ pocket: Pocket }>(`/pockets/${id}`),

    create: (name: string) =>
      this.post<{ pocket: Pocket }>('/pockets', { name }),

    delete: (id: string) =>
      this.del<{ deleted: boolean }>(`/pockets/${id}`),

    nativeBalance: (id: string) =>
      this.get<{ lamports: string; sol: string }>(`/pockets/${id}/balance`),

    deposit: (id: string, amount: string) =>
      this.post<{ newBalanceSol: string }>(`/pockets/${id}/deposit`, { amount }),

    withdraw: (id: string, amount: string, toAddress: string) =>
      this.post<{ newBalanceSol: string }>(`/pockets/${id}/withdraw`, { amount, toAddress }),
  }

  // ── Wallets ───────────────────────────────────────────────────────────────

  wallets = {
    add: (pocketId: string, params: { address: string; chain?: ChainId; type?: string; label?: string }) =>
      this.post<{ wallet: Wallet }>(`/pockets/${pocketId}/wallets`, { chain: 'solana', type: 'hot', ...params }),

    remove: (pocketId: string, walletId: string) =>
      this.del<{ deleted: boolean }>(`/pockets/${pocketId}/wallets/${walletId}`),

    setDefault: (pocketId: string, walletId: string) =>
      this.patch<{ wallet: Wallet }>(`/pockets/${pocketId}/wallets/${walletId}/default`),
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  balances = {
    get: (pocketId: string) =>
      this.get<{ totalUsd: number; wallets: any[] }>(`/balances/${pocketId}`),

    sync: (pocketId: string) =>
      this.post<{ message: string }>(`/balances/${pocketId}/sync`),
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  transactions = {
    list: (pocketId: string) =>
      this.get<{ transactions: Transaction[] }>(`/transactions/${pocketId}`),
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  payments = {
    resolveAgent: (pocketId: string, params: {
      to: string; amount: string; token: string; chain?: ChainId; memo?: string
    }) =>
      this.post<{ decision: any }>('/agent/resolve-payment', { pocketId, ...params }),

    payWithAgent: (pocketId: string, params: {
      to: string; amount: string; token: string; chain?: ChainId; memo?: string
    }) =>
      this.post<{ decision: any; tx: any }>(`/pockets/${pocketId}/pay/agent`, params),

    execute: (pocketId: string, params: {
      walletId: string; to: string; amount: string; token: string; chain: ChainId; memo?: string
    }) =>
      this.post<{ txId: string; status: string }>(`/pockets/${pocketId}/pay`, params),
  }

  // ── AI Agent ──────────────────────────────────────────────────────────────

  agent = {
    analyze: (pocketId: string) =>
      this.post<{ analysis: any }>(`/agent/analyze/${pocketId}`),
  }

  // ── DeFi ─────────────────────────────────────────────────────────────────

  defi = {
    getQuote: (params: { from: string; to: string; amount: number }) =>
      this.get<{ quote: any }>(`/defi/quote?from=${params.from}&to=${params.to}&amount=${params.amount}`),

    getGas: () =>
      this.get<{ fee: any; chain: string }>('/defi/gas'),

    getMetrics: (tokens: string[]) =>
      this.get<{ metrics: any[] }>(`/defi/metrics?tokens=${tokens.join(',')}`),

    getYield: (pocketId?: string) =>
      this.get<{ opportunities: any[] }>(`/defi/yield${pocketId ? `?pocketId=${pocketId}` : ''}`),

    createAlert: (token: string, direction: 'above' | 'below', targetUsd: number) =>
      this.post<{ alert: any }>('/defi/alerts', { token, direction, targetUsd }),

    listAlerts: () =>
      this.get<{ alerts: any[] }>('/defi/alerts'),

    deleteAlert: (alertId: string) =>
      this.del<{ deleted: boolean }>(`/defi/alerts/${alertId}`),
  }

  // ── NFTs ──────────────────────────────────────────────────────────────────

  nfts = {
    list: (pocketId: string) =>
      this.get<{ nfts: any[]; totalItems: number; estimatedValueSOL: number }>(`/nfts/${pocketId}`),

    sync: (pocketId: string) =>
      this.post<{ message: string }>(`/nfts/${pocketId}/sync`),

    get: (mint: string) =>
      this.get<{ nft: any }>(`/nfts/token/${mint}`),

    transfer: (mint: string, fromAddress: string, toAddress: string) =>
      this.post<{ transaction: string; isProgrammable: boolean }>('/nfts/transfer', { mint, fromAddress, toAddress }),

    marketplaceStats: (collectionSymbol: string) =>
      this.get<{ stats: any; recentSales: any[] }>(`/nfts/marketplace/${collectionSymbol}`),
  }

  // ── Staking ───────────────────────────────────────────────────────────────

  staking = {
    portfolio: (pocketId: string) =>
      this.get<{ portfolios: any[]; totalStakedSOL: number }>(`/staking/${pocketId}/portfolio`),

    validators: (limit = 20) =>
      this.get<{ validators: any[] }>(`/staking/validators?limit=${limit}`),

    liquidOptions: () =>
      this.get<{ options: any[] }>('/staking/liquid-options'),
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  analytics = {
    report: (pocketId: string) =>
      this.get<{ report: any }>(`/analytics/${pocketId}/report`),

    history: (pocketId: string, days = 30) =>
      this.get<{ history: any[] }>(`/analytics/${pocketId}/history?days=${days}`),

    pnl: (pocketId: string) =>
      this.get<{ pnl: any[]; currentUsd: number }>(`/analytics/${pocketId}/pnl`),

    snapshot: (pocketId: string) =>
      this.post<{ snapshotTaken: boolean }>(`/analytics/${pocketId}/snapshot`),
  }

  // ── Push notifications ────────────────────────────────────────────────────

  push = {
    register: (token: string, platform: 'ios' | 'android' | 'web') =>
      this.post<{ registered: boolean }>('/push/register', { token, platform }),

    unregister: (token: string) =>
      this.del<{ removed: boolean }>('/push/token'),
  }

  // ── Health ────────────────────────────────────────────────────────────────

  health = {
    check: () =>
      this.get<{ status: string; version: string; timestamp: string }>('/health'),

    chains: () =>
      this.get<{ chains: Record<string, boolean>; healthy: number; total: number }>('/health/chains'),
  }
}

// ── Error type ────────────────────────────────────────────────────────────────

export class ClutchError extends Error {
  constructor(
    message:         string,
    public code:     string,
    public status:   number,
  ) {
    super(message)
    this.name = 'ClutchError'
  }
}
