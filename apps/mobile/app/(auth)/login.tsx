import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useRouter, Link } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../src/lib/auth'

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Email and password required'); return }
    setError(''); setLoading(true)
    try {
      await login(email, password)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace('/(tabs)')
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
      <View style={s.inner}>
        <Text style={s.logo}>🫙</Text>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to your Clutch</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput style={s.input} placeholder="Email" placeholderTextColor="#71717a"
          value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor="#71717a"
          value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" style={s.link}>
          No account? <Text style={s.linkHighlight}>Create one</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#09090b' },
  inner:       { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo:        { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title:       { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitle:    { fontSize: 15, color: '#71717a', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  error:       { backgroundColor: '#450a0a', color: '#fca5a5', padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 16, textAlign: 'center' },
  input:       { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, marginBottom: 12 },
  btn:         { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#000', fontWeight: '700', fontSize: 15 },
  link:        { color: '#71717a', textAlign: 'center', marginTop: 20, fontSize: 14 },
  linkHighlight: { color: '#4ade80', fontWeight: '600' },
})
