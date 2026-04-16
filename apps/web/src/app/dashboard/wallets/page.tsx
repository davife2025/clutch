'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { WalletCard } from '@/components/wallet/WalletCard'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import { chainLabel } from '@/lib/utils'

export default function WalletsPage() {
  const [wallets, setWallets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await api.getPockets()
      const all: any[] = []
      for (const pocket of data.pockets) {
        for (const w of pocket.wallets ?? []) {
          all.push({ ...w, pocketName: pocket.name, pocketId: pocket.id })
        }
      }
      setWallets(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(pocketId: string, walletId: string) {
    if (!confirm('Remove this wallet?')) return
    await api.removeWallet(pocketId, walletId)
    load()
  }

  async function handleSetDefault(pocketId: string, walletId: string) {
    await api.setDefaultWallet(pocketId, walletId)
    load()
  }

  const grouped = wallets.reduce((acc: Record<string, any[]>, w) => {
    const key = w.chain
    if (!acc[key]) acc[key] = []
    acc[key].push(w)
    return acc
  }, {})

  return (
    <div>
      <TopBar title="Wallets" />
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : wallets.length === 0 ? (
        <EmptyState icon="👜" title="No wallets yet" description="Add wallets from within a pocket." />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([chain, ws]) => (
            <div key={chain}>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                {chainLabel(chain)} · {ws.length}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ws.map((w) => (
                  <div key={w.id}>
                    <p className="text-xs text-zinc-600 mb-1.5">in {w.pocketName}</p>
                    <WalletCard
                      wallet={w}
                      onDelete={() => handleDelete(w.pocketId, w.id)}
                      onSetDefault={() => handleSetDefault(w.pocketId, w.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
