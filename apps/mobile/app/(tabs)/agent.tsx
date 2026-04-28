import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api } from '../../src/lib/api'

export default function AgentTabScreen() {
  const router = useRouter()
  const [pockets, setPockets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPockets().then((d) => setPockets(d.pockets)).finally(() => setLoading(false))
  }, [])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>AI Agent</Text>
        <Text style={s.sub}>Powered by Claude</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.hint}>Select a pocket to chat with your agent</Text>
        {loading ? <Text style={s.loading}>Loading...</Text> : pockets.length === 0
          ? <Text style={s.empty}>Create a pocket first to use the AI agent.</Text>
          : pockets.map((p) => (
              <TouchableOpacity key={p.id} style={s.card} onPress={() => router.push(`/agent/${p.id}`)}>
                <Text style={s.cardEmoji}>🫙</Text>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{p.name}</Text>
                  <Text style={s.cardSub}>{p.wallets?.length ?? 0} wallets</Text>
                </View>
                <Text style={s.sparkle}>✦ Chat</Text>
              </TouchableOpacity>
            ))
        }
      </ScrollView>
    </SafeAreaView>
  )
}
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#09090b' },
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title:     { fontSize: 24, fontWeight: '700', color: '#fff' },
  sub:       { fontSize: 13, color: '#52525b', marginTop: 2, marginBottom: 16 },
  content:   { paddingHorizontal: 16, paddingBottom: 32 },
  hint:      { fontSize: 13, color: '#52525b', marginBottom: 14 },
  loading:   { color: '#52525b', textAlign: 'center', marginTop: 40 },
  empty:     { color: '#52525b', textAlign: 'center', marginTop: 40, fontSize: 14 },
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 16, marginBottom: 10 },
  cardEmoji: { fontSize: 24 },
  cardInfo:  { flex: 1 },
  cardName:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardSub:   { color: '#52525b', fontSize: 12, marginTop: 2 },
  sparkle:   { color: '#22c55e', fontSize: 13, fontWeight: '600' },
})
