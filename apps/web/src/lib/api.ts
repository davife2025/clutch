const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('clutch_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Request failed')
  return json.data
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    request<{ token: string; userId: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; userId: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),

  // Pockets
  getPockets: () => request<{ pockets: any[] }>('/pockets'),
  getPocket: (id: string) => request<{ pocket: any }>(`/pockets/${id}`),
  createPocket: (name: string) =>
    request<{ pocket: any }>('/pockets', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePocket: (id: string) =>
    request<{ deleted: boolean }>(`/pockets/${id}`, { method: 'DELETE' }),

  // Wallets
  addWallet: (pocketId: string, data: { address: string; chain: string; type: string; label?: string }) =>
    request<{ wallet: any }>(`/pockets/${pocketId}/wallets`, {
      method: 'POST', body: JSON.stringify(data),
    }),
  removeWallet: (pocketId: string, walletId: string) =>
    request<{ deleted: boolean }>(`/pockets/${pocketId}/wallets/${walletId}`, { method: 'DELETE' }),
  setDefaultWallet: (pocketId: string, walletId: string) =>
    request<{ wallet: any }>(`/pockets/${pocketId}/wallets/${walletId}/default`, { method: 'PATCH' }),

  // Balances
  getBalances: (pocketId: string) => request<any>(`/balances/${pocketId}`),
  syncBalances: (pocketId: string) =>
    request<{ message: string }>(`/balances/${pocketId}/sync`, { method: 'POST' }),

  // Transactions
  getTransactions: (pocketId: string) => request<{ transactions: any[] }>(`/transactions/${pocketId}`),

  // Native funds
  deposit: (pocketId: string, amount: string) =>
    request<any>(`/pockets/${pocketId}/deposit`, {
      method: 'POST', body: JSON.stringify({ amount }),
    }),
  withdraw: (pocketId: string, amount: string, toAddress: string) =>
    request<any>(`/pockets/${pocketId}/withdraw`, {
      method: 'POST', body: JSON.stringify({ amount, toAddress }),
    }),

  // Health
  chainHealth: () => request<any>('/health/chains'),
}
