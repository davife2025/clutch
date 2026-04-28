import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { api } from '../../src/lib/api'
import { formatUsd } from '../../src/lib/utils'

export default function DashboardScreen() {
  const router = useRouter()
  const [pockets, setPockets]   = useState<any[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.getPockets()
      setPockets(data.pockets)
      data.pockets.forEach(async (p: any) => {
        try {
          const b = await api.getBalances(p.id)
          setBalances((prev) => ({ ...prev, [p.id]: b.totalUsd ?? 0 }))
        } catch {}
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createPocket() {
    Alert.prompt('New Pocket', 'Enter a name for your pocket', async (name) => {
      if (!name?.trim()) return
      await api.createPocket(name.trim())
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      load()
    })
  }

  async function deletePocket(id: string) {
    Alert.alert('Delete pocket?', 'This will remove all wallets in this pocket.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deletePocket(id); load() } },
    ])
  }

  const totalUsd    = Object.values(balances).reduce((s, v) => s + v, 0)
  const walletCount = pockets.reduce((s, p) => s + (p.wallets?.length ?? 0), 0)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#22c55e" />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>🫙</Text>
          <Text style={s.appName}>Clutch</Text>
          <TouchableOpacity style={s.newBtn} onPress={createPocket}>
            <Text style={s.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Total value hero */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>Total value</Text>
          <Text style={s.heroValue}>{formatUsd(totalUsd)}</Text>
          <Text style={s.heroSub}>{pockets.length} pocket{pockets.length !== 1 ? 's' : ''} · {walletCount} wallet{walletCount !== 1 ? 's' : ''}</Text>
        </View>

        {/* Pockets */}
        {loading ? (
          <Text style={s.loading}>Loading...</Text>
        ) : pockets.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🫙</Text>
            <Text style={s.emptyTitle}>No pockets yet</Text>
            <Text style={s.emptyText}>Create your first pocket to start adding wallets.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={createPocket}>
              <Text style={s.emptyBtnText}>Create pocket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {pockets.map((p) => (
              <TouchableOpacity key={p.id} style={s.card} onPress={() => router.push(`/pocket/${p.id}`)}
                onLongPress={() => deletePocket(p.id)}>
                <View style={s.cardLeft}>
                  <Text style={s.cardEmoji}>🫙</Text>
                  <View>
                    <Text style={s.cardName}>{p.name}</Text>
                    <Text style={s.cardSub}>{p.wallets?.length ?? 0} wallet{p.wallets?.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={s.cardRight}>
                  <Text style={s.cardValue}>{formatUsd(balances[p.id] ?? 0)}</Text>
                  <Text style={s.cardChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#09090b' },
  scroll:       { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  logo:         { fontSize: 22, marginRight: 6 },
  appName:      { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  newBtn:       { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  newBtnText:   { color: '#000', fontWeight: '700', fontSize: 13 },
  hero:         { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  heroLabel:    { fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  heroValue:    { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  heroSub:      { fontSize: 13, color: '#52525b', marginTop: 6 },
  loading:      { textAlign: 'center', color: '#52525b', marginTop: 40 },
  empty:        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptyText:    { fontSize: 14, color: '#71717a', textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { backgroundColor: '#22c55e', marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#000', fontWeight: '700' },
  list:         { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  card:         { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  cardEmoji:    { fontSize: 24 },
  cardName:     { fontSize: 15, fontWeight: '600', color: '#fff' },
  cardSub:      { fontSize: 12, color: '#71717a', marginTop: 2 },
  cardRight:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardValue:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardChevron:  { fontSize: 18, color: '#52525b' },
})
