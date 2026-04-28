'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, Plus } from 'lucide-react'
import Link from 'next/link'
import { WalletCard } from '@/components/wallet/WalletCard'
import { AddWalletModal } from '@/components/wallet/AddWalletModal'
import { NativeFundsPanel } from '@/components/pocket/NativeFundsPanel'
import { TransactionList } from '@/components/pocket/TransactionList'
import { Spinner } from '@/components/ui/Spinner'
import { formatUsd, timeAgo } from '@/lib/utils'
import { api } from '@/lib/api'

export default function PocketDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [pocket, setPocket]     = useState<any>(null)
  const [balances, setBalances] = useState<any>(null)
  const [txns, setTxns]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [addWallet, setAddWallet] = useState(false)
  const [showFunds, setShowFunds] = useState(false)
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
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    await api.syncBalances(id)
    setTimeout(() => { load(); setSyncing(false) }, 3000)
  }

  async function handleDeleteWallet(walletId: string) {
    if (!confirm('Remove this wallet from the pocket?')) return
    await api.removeWallet(id, walletId)
    load()
  }

  async function handleSetDefault(walletId: string) {
    await api.setDefaultWallet(id, walletId)
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
  if (!pocket) return <div className="text-center py-20 text-zinc-500">Pocket not found</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-white">{pocket.name}</h1>
        <span className="text-zinc-500 text-sm">· Updated {timeAgo(pocket.updatedAt)}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total value</p>
          <p className="text-2xl font-bold text-white">{formatUsd(balances?.totalUsd ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Wallets</p>
          <p className="text-2xl font-bold text-white">{pocket.wallets?.length ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Native balance</p>
          <p className="text-2xl font-bold text-white">{(Number(pocket.nativeBalance ?? 0) / 1e9).toFixed(6)} SOL</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button className="btn-primary flex items-center gap-2" onClick={() => setAddWallet(true)}>
          <Plus size={15} /> Add wallet
        </button>
        <button className="btn-ghost flex items-center gap-2" onClick={() => setShowFunds(true)}>
          Deposit / Withdraw
        </button>
        <button className="btn-ghost flex items-center gap-2" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync balances'}
        </button>
      </div>

      <div className="flex gap-1 mb-5 bg-zinc-900 p-1 rounded-xl w-fit">
        {(['wallets', 'activity'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'wallets' && (
        !pocket.wallets || pocket.wallets.length === 0
          ? <div className="card p-10 text-center"><p className="text-4xl mb-3">👜</p><p className="text-zinc-400">No wallets yet. Add one to get started.</p></div>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pocket.wallets.map((w: any) => {
                const walletBals = balances?.wallets?.find((b: any) => b.walletId === w.id)
                return <WalletCard key={w.id} wallet={{ ...w, balances: walletBals?.balances ?? w.balances ?? [] }} onDelete={() => handleDeleteWallet(w.id)} onSetDefault={() => handleSetDefault(w.id)} />
              })}
            </div>
      )}

      {activeTab === 'activity' && <TransactionList transactions={txns} />}

      <AddWalletModal pocketId={id} open={addWallet} onClose={() => setAddWallet(false)} onAdded={load} />
      <NativeFundsPanel pocketId={id} nativeBalance={pocket.nativeBalance ?? '0'} open={showFunds} onClose={() => setShowFunds(false)} onSuccess={load} />
    </div>
  )
}
