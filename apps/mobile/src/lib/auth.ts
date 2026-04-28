import { createContext, useContext, useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { api, saveToken, clearToken, getToken } from './api'

interface AuthState {
  token: string | null
  userId: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  authenticateWithBiometrics: () => Promise<boolean>
}

// @ts-expect-error — always provided by AuthProvider
export const AuthContext = createContext<AuthState>({})
export const useAuth = () => useContext(AuthContext)

export function useAuthProvider(): AuthState {
  const [token, setToken]     = useState<string | null>(null)
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getToken().then(async (t) => {
      setToken(t)
      if (t) setUserId(await SecureStore.getItemAsync('clutch_userId'))
    }).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await api.login(email, password)
    await saveToken(data.token, data.userId)
    setToken(data.token)
    setUserId(data.userId)
  }

  async function register(email: string, password: string) {
    const data = await api.register(email, password)
    await saveToken(data.token, data.userId)
    setToken(data.token)
    setUserId(data.userId)
  }

  async function logout() {
    await clearToken()
    setToken(null)
    setUserId(null)
  }

  async function authenticateWithBiometrics(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync()
    if (!hasHardware || !isEnrolled) return true

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify your identity to access Clutch',
      fallbackLabel: 'Use passcode',
    })
    return result.success
  }

  return { token, userId, loading, login, register, logout, authenticateWithBiometrics }
}
