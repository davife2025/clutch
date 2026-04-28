import { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { truncateAddress, timeAgo } from '../../src/lib/utils'

const TX_ICONS: Record<string, string> = { deposit: '↓', withdraw: '↑', payment: '⚡', transfer: '↕' }

export default function ActivityScreen() {
  const [txns, setTxns]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const data = await api.getPockets()
      const all: any[] = []
      await Promise.allSettled(data.pockets.map(async (p: any) => {
        const t = await api.getTransactions(p.id)
        all.push(...t.transactions.map((tx: any) => ({ ...tx, pocketName: p.name })))
      }))
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setTxns(all)
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Activity</Text></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#22c55e" />}>
        {loading ? <Text style={s.empty}>Loading...</Text>
        : txns.length === 0 ? <Text style={s.empty}>No transactions yet.</Text>
        : <View style={s.list}>
            {txns.map((tx) => (
              <View key={tx.id} style={s.row}>
                <View style={s.icon}><Text style={s.iconText}>{TX_ICONS[tx.type] ?? '↕'}</Text></View>
                <View style={s.info}>
                  <Text style={s.type}>{tx.type}</Text>
                  <Text style={s.addr}>{truncateAddress(tx.toAddress)} · {tx.pocketName}</Text>
                </View>
                <View style={s.right}>
                  <Text style={s.amount}>{(Number(tx.amount) / 1e9).toFixed(4)} {tx.token}</Text>
                  <Text style={s.time}>{timeAgo(tx.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        }
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#09090b' },
  header:  { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title:   { fontSize: 24, fontWeight: '700', color: '#fff' },
  empty:   { color: '#52525b', textAlign: 'center', marginTop: 60, fontSize: 14 },
  list:    { paddingHorizontal: 16, gap: 8, paddingBottom: 32 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181b', borderRadius: 14, padding: 12 },
  icon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#a1a1aa' },
  info:    { flex: 1 },
  type:    { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  addr:    { color: '#52525b', fontSize: 12, marginTop: 2 },
  right:   { alignItems: 'flex-end' },
  amount:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  time:    { color: '#52525b', fontSize: 11, marginTop: 2 },
})
