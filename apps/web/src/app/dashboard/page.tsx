'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { PocketCard } from '@/components/pocket/PocketCard'
import { StatsBar } from '@/components/pocket/StatsBar'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'

export default function DashboardPage() {
  const [pockets, setPockets]     = useState<any[]>([])
  const [balances, setBalances]   = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)
  const [newPocketName, setNewPocketName] = useState('')
  const [creating, setCreating]   = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const loadPockets = useCallback(async () => {
    try {
      const data = await api.getPockets()
      setPockets(data.pockets)
      // Load balances for each pocket in background
      data.pockets.forEach(async (p: any) => {
        try {
          const b = await api.getBalances(p.id)
          setBalances((prev) => ({ ...prev, [p.id]: b.totalUsd }))
        } catch {}
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPockets() }, [loadPockets])

  async function handleCreate() {
    if (!newPocketName.trim()) return
    setCreating(true)
    try {
      await api.createPocket(newPocketName.trim())
      setNewPocketName('')
      setShowCreate(false)
      loadPockets()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this pocket and all its wallets?')) return
    await api.deletePocket(id)
    loadPockets()
  }

  const totalUsd    = Object.values(balances).reduce((s, v) => s + v, 0)
  const walletCount = pockets.reduce((s, p) => s + (p.wallets?.length ?? 0), 0)

  return (
    <div>
      <TopBar
        title="Dashboard"
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New pocket
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : (
        <>
          <StatsBar totalUsd={totalUsd} pocketCount={pockets.length} walletCount={walletCount} />

          {pockets.length === 0 ? (
            <EmptyState
              icon="🫙"
              title="No pockets yet"
              description="Create your first pocket to start adding wallets."
              action={
                <button className="btn-primary" onClick={() => setShowCreate(true)}>
                  Create pocket
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pockets.map((p) => (
                <PocketCard
                  key={p.id}
                  pocket={p}
                  totalUsd={balances[p.id] ?? 0}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create pocket modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New pocket">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Pocket name</label>
            <input className="input" placeholder="e.g. Main Pocket, DeFi, Trading"
              value={newPocketName}
              onChange={(e) => setNewPocketName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              autoFocus />
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
