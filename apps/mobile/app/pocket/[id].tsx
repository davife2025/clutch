import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Share } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { api } from '../../src/lib/api'
import { formatUsd, truncateAddress, chainLabel, timeAgo, formatTokenAmount } from '../../src/lib/utils'

export default function PocketScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()

  const [pocket, setPocket]     = useState<any>(null)
  const [balances, setBalances] = useState<any>(null)
  const [txns, setTxns]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [activeTab, setActiveTab] = useState<'wallets'|'activity'>('wallets')

  const load = useCallback(async () => {
    try {
      const [p, b, t] = await Promise.all([
        api.getPocket(id),
        api.getBalances(id).catch(() => null),
        api.getTransactions(id).catch(() => ({ transactions: [] })),
      ])
      setPocket(p.pocket)
      setBalances(b)
      setTxns(t.transactions)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    await api.syncBalances(id)
    setTimeout(() => { load(); setSyncing(false) }, 3000)
  }

  async function handleCopyAddress(address: string) {
    await Clipboard.setStringAsync(address)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied', 'Address copied to clipboard')
  }

  async function handleRemoveWallet(walletId: string) {
    Alert.alert('Remove wallet?', 'This will remove the wallet from this pocket.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.removeWallet(id, walletId); load() } },
    ])
  }

  if (loading) return (
    <SafeAreaView style={s.safe}><Text style={s.loading}>Loading...</Text></SafeAreaView>
  )

  if (!pocket) return (
    <SafeAreaView style={s.safe}><Text style={s.loading}>Pocket not found</Text></SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{pocket.name}</Text>
        <TouchableOpacity onPress={handleSync} style={s.syncBtn}>
          <Text style={s.syncText}>{syncing ? '↻' : '⟳'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#22c55e" />}
      >
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Total value</Text>
            <Text style={s.statValue}>{formatUsd(balances?.totalUsd ?? 0)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Wallets</Text>
            <Text style={s.statValue}>{pocket.wallets?.length ?? 0}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Native</Text>
            <Text style={s.statValue}>{(Number(pocket.nativeBalance ?? 0) / 1e18).toFixed(4)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn}
            onPress={() => Alert.prompt('Add Wallet', 'Enter address (0x... or Solana)', async (addr) => {
              if (!addr) return
              await api.addWallet(id, { address: addr.trim(), chain: 'ethereum', type: 'hot' })
              load()
            })}>
            <Text style={s.actionBtnText}>+ Add wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost]}
            onPress={() => router.push(`/agent/${id}`)}>
            <Text style={[s.actionBtnText, s.actionBtnGhostText]}>✦ AI Agent</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['wallets', 'activity'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Wallets */}
        {activeTab === 'wallets' && (
          <View style={s.section}>
            {!pocket.wallets || pocket.wallets.length === 0 ? (
              <Text style={s.empty}>No wallets yet. Tap "+ Add wallet" above.</Text>
            ) : (
              pocket.wallets.map((w: any) => {
                const wBals = balances?.wallets?.find((b: any) => b.walletId === w.id)
                const totalUsd = (wBals?.balances ?? []).reduce((s: number, b: any) => s + parseFloat(b.usdValue ?? '0'), 0)
                return (
                  <View key={w.id} style={s.walletCard}>
                    <View style={s.walletHeader}>
                      <View>
                        <View style={s.walletBadgeRow}>
                          <Text style={s.badge}>{chainLabel(w.chain)}</Text>
                          <Text style={s.badge}>{w.type}</Text>
                          {w.isDefault && <Text style={[s.badge, s.badgeGreen]}>default</Text>}
                        </View>
                        {w.label && <Text style={s.walletLabel}>{w.label}</Text>}
                        <TouchableOpacity onPress={() => handleCopyAddress(w.address)}>
                          <Text style={s.walletAddress}>{truncateAddress(w.address)} ⎘</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveWallet(w.id)} style={s.removeBtn}>
                        <Text style={s.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {wBals?.balances?.length > 0 && (
                      <View style={s.balances}>
                        {wBals.balances.slice(0, 4).map((b: any) => (
                          <View key={b.id} style={s.balanceRow}>
                            <Text style={s.balanceToken}>{b.token}</Text>
                            <Text style={s.balanceAmount}>{formatTokenAmount(b.amount, b.decimals)}</Text>
                            {b.usdValue && <Text style={s.balanceUsd}>${parseFloat(b.usdValue).toFixed(2)}</Text>}
                          </View>
                        ))}
                        <View style={[s.balanceRow, s.balanceTotal]}>
                          <Text style={s.balanceTotalLabel}>Total</Text>
                          <Text style={s.balanceTotalValue}>{formatUsd(totalUsd)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* Activity */}
        {activeTab === 'activity' && (
          <View style={s.section}>
            {txns.length === 0 ? (
              <Text style={s.empty}>No transactions yet.</Text>
            ) : (
              txns.map((tx) => (
                <View key={tx.id} style={s.txRow}>
                  <View style={s.txIcon}>
                    <Text style={s.txIconText}>{tx.type === 'deposit' ? '↓' : tx.type === 'withdraw' ? '↑' : tx.type === 'payment' ? '⚡' : '↕'}</Text>
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txType}>{tx.type}</Text>
                    <Text style={s.txAddr}>{truncateAddress(tx.toAddress)}</Text>
                  </View>
                  <View style={s.txRight}>
                    <Text style={s.txAmount}>{(Number(tx.amount) / 1e9).toFixed(4)} {tx.token}</Text>
                    <Text style={s.txTime}>{timeAgo(tx.createdAt)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#09090b' },
  loading:          { color: '#52525b', textAlign: 'center', marginTop: 60, fontSize: 14 },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  back:             { paddingRight: 12 },
  backText:         { color: '#22c55e', fontSize: 16 },
  title:            { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  syncBtn:          { paddingLeft: 12 },
  syncText:         { color: '#52525b', fontSize: 20 },
  statsRow:         { flexDirection: 'row', gap: 12, padding: 16 },
  stat:             { flex: 1, backgroundColor: '#18181b', borderRadius: 14, padding: 14 },
  statLabel:        { fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue:        { fontSize: 18, fontWeight: '700', color: '#fff' },
  actionRow:        { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn:        { flex: 1, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  actionBtnText:    { color: '#000', fontWeight: '700', fontSize: 14 },
  actionBtnGhost:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3f3f46' },
  actionBtnGhostText: { color: '#a1a1aa' },
  tabs:             { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, backgroundColor: '#18181b', borderRadius: 12, padding: 4 },
  tab:              { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:        { backgroundColor: '#27272a' },
  tabText:          { fontSize: 13, color: '#52525b', fontWeight: '600' },
  tabTextActive:    { color: '#fff' },
  section:          { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  empty:            { color: '#52525b', textAlign: 'center', marginTop: 24, fontSize: 14 },
  walletCard:       { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 16, padding: 14 },
  walletHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  walletBadgeRow:   { flexDirection: 'row', gap: 6, marginBottom: 4 },
  badge:            { fontSize: 11, backgroundColor: '#27272a', color: '#a1a1aa', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  badgeGreen:       { backgroundColor: '#052e16', color: '#86efac' },
  walletLabel:      { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  walletAddress:    { color: '#52525b', fontSize: 12, fontFamily: 'monospace' },
  removeBtn:        { padding: 4 },
  removeBtnText:    { color: '#3f3f46', fontSize: 16 },
  balances:         { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272a', gap: 6 },
  balanceRow:       { flexDirection: 'row', alignItems: 'center' },
  balanceToken:     { color: '#71717a', fontSize: 13, flex: 1 },
  balanceAmount:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  balanceUsd:       { color: '#52525b', fontSize: 12, marginLeft: 8 },
  balanceTotal:     { paddingTop: 6, borderTopWidth: 1, borderTopColor: '#27272a', marginTop: 4 },
  balanceTotalLabel: { color: '#52525b', fontSize: 12, flex: 1 },
  balanceTotalValue: { color: '#fff', fontWeight: '700', fontSize: 14 },
  txRow:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181b', borderRadius: 14, padding: 12 },
  txIcon:           { width: 36, height: 36, borderRadius: 10, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  txIconText:       { fontSize: 16, color: '#a1a1aa' },
  txInfo:           { flex: 1 },
  txType:           { color: '#fff', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  txAddr:           { color: '#52525b', fontSize: 12, marginTop: 2 },
  txRight:          { alignItems: 'flex-end' },
  txAmount:         { color: '#fff', fontSize: 13, fontWeight: '600' },
  txTime:           { color: '#52525b', fontSize: 11, marginTop: 2 },
})
