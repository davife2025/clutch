'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, Plus, ChevronRight, Check, X, Clock, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  }).then((r) => r.json())
}

const ROLE_COLORS: Record<string, string> = {
  owner:  'bg-purple-900 text-purple-300',
  admin:  'bg-blue-900 text-blue-300',
  signer: 'bg-green-900 text-green-300',
  viewer: 'bg-zinc-800 text-zinc-400',
}

export default function TeamPage() {
  const [pockets, setPockets]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]           = useState({ name: '', description: '', threshold: '2' })
  const [creating, setCreating]   = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    authFetch('/team').then((r) => setPockets(r.data?.pockets ?? [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError(''); setCreating(true)
    try {
      const r = await authFetch('/team', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description, threshold: parseInt(form.threshold) }),
      })
      if (r.error) throw new Error(r.error.message)
      setShowCreate(false)
      setForm({ name: '', description: '', threshold: '2' })
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <TopBar
        title="Team pockets"
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New team pocket
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : pockets.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No team pockets"
          description="Create a shared pocket with multi-sig approval flows."
          action={<button className="btn-primary" onClick={() => setShowCreate(true)}>Create team pocket</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pockets.map((p) => (
            <Link key={p.id} href={`/dashboard/team/${p.id}`}
              className="card p-5 hover:border-zinc-700 transition-colors block">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Users size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{p.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{p.members?.length ?? 1} members</p>
                  </div>
                </div>
                <span className={cn('badge', ROLE_COLORS[p.myRole] ?? ROLE_COLORS.viewer)}>{p.myRole}</span>
              </div>
              {p.description && <p className="text-sm text-zinc-400 mb-3">{p.description}</p>}
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Shield size={11} />
                  <span>{p.threshold}-of-{p.members?.length ?? 1} threshold</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  View <ChevronRight size={13} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New team pocket">
        <div className="space-y-4">
          {error && <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">{error}</div>}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Name</label>
            <input className="input" placeholder="e.g. Treasury, Operations" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Description (optional)</label>
            <input className="input text-sm" placeholder="What is this pocket for?"
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Approval threshold</label>
            <select className="input text-sm" value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} signature{n > 1 ? 's' : ''} required</option>)}
            </select>
            <p className="text-xs text-zinc-600 mt-1.5">How many members must approve before a transaction executes.</p>
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
