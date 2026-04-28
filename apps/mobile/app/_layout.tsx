import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthContext, useAuthProvider } from '../src/lib/auth'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuthProvider()
  const router   = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!token && !inAuth) router.replace('/(auth)/login')
    if (token && inAuth) router.replace('/(tabs)')
  }, [token, loading, segments])

  return <>{children}</>
}

export default function RootLayout() {
  const auth = useAuthProvider()
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthContext.Provider value={auth}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pocket/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="agent/[pocketId]" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
