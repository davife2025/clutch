import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('clutch_token')
}

export async function saveToken(token: string, userId: string): Promise<void> {
  await SecureStore.setItemAsync('clutch_token', token)
  await SecureStore.setItemAsync('clutch_userId', userId)
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('clutch_token')
  await SecureStore.deleteItemAsync('clutch_userId')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
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
  login:    (email: string, password: string) =>
    request<{ token: string; userId: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    request<{ token: string; userId: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getPockets:   () => request<{ pockets: any[] }>('/pockets'),
  getPocket:    (id: string) => request<{ pocket: any }>(`/pockets/${id}`),
  createPocket: (name: string) => request<{ pocket: any }>('/pockets', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePocket: (id: string) => request<any>(`/pockets/${id}`, { method: 'DELETE' }),

  addWallet:        (pocketId: string, data: any) => request<{ wallet: any }>(`/pockets/${pocketId}/wallets`, { method: 'POST', body: JSON.stringify(data) }),
  removeWallet:     (pocketId: string, walletId: string) => request<any>(`/pockets/${pocketId}/wallets/${walletId}`, { method: 'DELETE' }),
  setDefaultWallet: (pocketId: string, walletId: string) => request<any>(`/pockets/${pocketId}/wallets/${walletId}/default`, { method: 'PATCH' }),

  getBalances:  (pocketId: string) => request<any>(`/balances/${pocketId}`),
  syncBalances: (pocketId: string) => request<any>(`/balances/${pocketId}/sync`, { method: 'POST' }),

  deposit:  (pocketId: string, amount: string) => request<any>(`/pockets/${pocketId}/deposit`, { method: 'POST', body: JSON.stringify({ amount }) }),
  withdraw: (pocketId: string, amount: string, toAddress: string) => request<any>(`/pockets/${pocketId}/withdraw`, { method: 'POST', body: JSON.stringify({ amount, toAddress }) }),

  agentAnalyze: (pocketId: string) => request<any>(`/agent/analyze/${pocketId}`, { method: 'POST' }),
  agentPay:     (pocketId: string, data: any) => request<any>(`/pockets/${pocketId}/pay/agent`, { method: 'POST', body: JSON.stringify(data) }),

  getTransactions: (pocketId: string) => request<{ transactions: any[] }>(`/transactions/${pocketId}`),
}
