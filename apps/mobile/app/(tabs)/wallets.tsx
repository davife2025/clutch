import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { chainLabel, truncateAddress, formatUsd } from '../../src/lib/utils'

export default function WalletsScreen() {
  const [wallets, setWallets]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const data = await api.getPockets()
      const all: any[] = []
      for (const p of data.pockets) {
        for (const w of p.wallets ?? []) {
          all.push({ ...w, pocketName: p.name, pocketId: p.id })
        }
      }
      setWallets(all)
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const grouped = wallets.reduce((acc: Record<string, any[]>, w) => {
    if (!acc[w.chain]) acc[w.chain] = []
    acc[w.chain].push(w)
    return acc
  }, {})

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Wallets</Text></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#22c55e" />}>
        {loading ? <Text style={s.empty}>Loading...</Text>
        : wallets.length === 0 ? <Text style={s.empty}>No wallets yet. Add them from a pocket.</Text>
        : Object.entries(grouped).map(([chain, ws]) => (
          <View key={chain} style={s.group}>
            <Text style={s.groupTitle}>{chainLabel(chain)} · {ws.length}</Text>
            {ws.map((w) => (
              <View key={w.id} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.label}>{w.label ?? truncateAddress(w.address)}</Text>
                  <View style={s.badges}>
                    <Text style={s.badge}>{w.type}</Text>
                    {w.isDefault && <Text style={[s.badge, s.badgeGreen]}>default</Text>}
                  </View>
                </View>
                <Text style={s.addr}>{truncateAddress(w.address)}</Text>
                <Text style={s.pocket}>in {w.pocketName}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#09090b' },
  header:     { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title:      { fontSize: 24, fontWeight: '700', color: '#fff' },
  empty:      { color: '#52525b', textAlign: 'center', marginTop: 60, fontSize: 14 },
  group:      { paddingHorizontal: 16, marginBottom: 24 },
  groupTitle: { fontSize: 12, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: '600' },
  card:       { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 14, padding: 14, marginBottom: 8 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label:      { color: '#fff', fontSize: 14, fontWeight: '600' },
  badges:     { flexDirection: 'row', gap: 6 },
  badge:      { fontSize: 11, color: '#71717a', backgroundColor: '#27272a', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  badgeGreen: { backgroundColor: '#052e16', color: '#86efac' },
  addr:       { color: '#52525b', fontSize: 12, fontFamily: 'monospace' },
  pocket:     { color: '#3f3f46', fontSize: 11, marginTop: 4 },
})
