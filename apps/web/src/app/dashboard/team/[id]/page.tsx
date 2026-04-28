'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Shield, Clock, Check, X, FileText } from 'lucide-react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { cn, timeAgo, formatUsd } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-900 text-yellow-300',
  approved: 'bg-green-900 text-green-300',
  executed: 'bg-blue-900 text-blue-300',
  rejected: 'bg-red-900 text-red-300',
  expired:  'bg-zinc-800 text-zinc-500',
}

const ROLE_STYLES: Record<string, string> = {
  owner:  'bg-purple-900 text-purple-300',
  admin:  'bg-blue-900 text-blue-300',
  signer: 'bg-green-900 text-green-300',
  viewer: 'bg-zinc-800 text-zinc-400',
}

export default function TeamDetailPage() {
  const { id: pocketId } = useParams<{ id: string }>()
  const [pocket, setPocket]       = useState<any>(null)
  const [myRole, setMyRole]       = useState<string>('')
  const [proposals, setProposals] = useState<any[]>([])
  const [audit, setAudit]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'proposals'|'members'|'audit'>('proposals')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showPropose, setShowPropose]     = useState(false)
  const [memberForm, setMemberForm]       = useState({ email: '', role: 'signer', limit: '' })
  const [propForm, setPropForm]           = useState({ title: '', type: 'payment', to: '', amount: '', token: 'SOL', memo: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pocketRes, proposalsRes, auditRes] = await Promise.all([
        authFetch(`/team/${pocketId}`),
        authFetch(`/proposals/${pocketId}`),
        authFetch(`/proposals/${pocketId}/audit`),
      ])
      setPocket(pocketRes.data?.pocket)
      setMyRole(pocketRes.data?.myRole ?? '')
      setProposals(proposalsRes.data?.proposals ?? [])
      setAudit(auditRes.data?.entries ?? [])
    } finally { setLoading(false) }
  }, [pocketId])

  useEffect(() => { load() }, [load])

  async function addMember() {
    const r = await authFetch(`/team/${pocketId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email: memberForm.email, role: memberForm.role, spendLimitUsd: memberForm.limit ? parseInt(memberForm.limit) : null }),
    })
    if (r.error) return alert(r.error.message)
    setShowAddMember(false); setMemberForm({ email: '', role: 'signer', limit: '' }); load()
  }

  async function createProposal() {
    const payload = propForm.type === 'payment'
      ? { type: 'payment', to: propForm.to, amount: propForm.amount, token: propForm.token, chain: 'solana', memo: propForm.memo }
      : { type: propForm.type }
    const r = await authFetch(`/proposals/${pocketId}`, {
      method: 'POST',
      body: JSON.stringify({ type: propForm.type, title: propForm.title, payload }),
    })
    if (r.error) return alert(r.error.message)
    setShowPropose(false); load()
  }

  async function approve(proposalId: string) {
    setActionLoading(proposalId + '-approve')
    await authFetch(`/proposals/${pocketId}/${proposalId}/approve`, { method: 'POST', body: JSON.stringify({}) })
    setActionLoading(null); load()
  }

  async function reject(proposalId: string) {
    setActionLoading(proposalId + '-reject')
    await authFetch(`/proposals/${pocketId}/${proposalId}/reject`, { method: 'POST', body: JSON.stringify({}) })
    setActionLoading(null); load()
  }

  const canSign = ['owner','admin','signer'].includes(myRole)
  const canManage = ['owner','admin'].includes(myRole)

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
  if (!pocket) return <div className="text-zinc-500 text-center py-20">Team pocket not found</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/team" className="text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={20}/></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{pocket.name}</h1>
          {pocket.description && <p className="text-zinc-500 text-sm mt-0.5">{pocket.description}</p>}
        </div>
        <span className={cn('badge', ROLE_STYLES[myRole])}>{myRole}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{pocket.members?.length ?? 1}</p>
          <p className="text-xs text-zinc-500 mt-1">Members</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{pocket.threshold}</p>
          <p className="text-xs text-zinc-500 mt-1">Threshold</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{proposals.filter(p => p.status === 'pending').length}</p>
          <p className="text-xs text-zinc-500 mt-1">Pending</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        {canSign && <button className="btn-primary flex items-center gap-2" onClick={() => setShowPropose(true)}><FileText size={15}/>New proposal</button>}
        {canManage && <button className="btn-ghost flex items-center gap-2" onClick={() => setShowAddMember(true)}><UserPlus size={15}/>Add member</button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-zinc-900 p-1 rounded-xl w-fit">
        {(['proposals','members','audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize', tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            {t}
          </button>
        ))}
      </div>

      {/* Proposals tab */}
      {tab === 'proposals' && (
        <div className="space-y-3">
          {proposals.length === 0 && <div className="card p-10 text-center text-zinc-500">No proposals yet</div>}
          {proposals.map(p => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{p.title}</h3>
                    <span className={cn('badge', STATUS_STYLES[p.status] ?? STATUS_STYLES.pending)}>{p.status}</span>
                    <span className="badge bg-zinc-800 text-zinc-400">{p.type}</span>
                  </div>
                  {p.payload?.to && (
                    <p className="text-xs text-zinc-500">
                      {p.payload.amount} {p.payload.token} → {p.payload.to.slice(0,12)}...
                    </p>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{timeAgo(p.createdAt)}</p>
              </div>

              {/* Approval progress */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((p.approvals?.length ?? 0) / pocket.threshold * 100, 100)}%` }} />
                </div>
                <span className="text-xs text-zinc-400">{p.approvals?.length ?? 0}/{pocket.threshold}</span>
              </div>

              {/* Approve / reject */}
              {canSign && p.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-900/30 text-green-300 hover:bg-green-900/50 text-sm font-medium transition-colors disabled:opacity-40"
                    onClick={() => approve(p.id)}
                    disabled={actionLoading === p.id + '-approve'}>
                    <Check size={13}/>{actionLoading === p.id + '-approve' ? '...' : 'Approve'}
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-900/30 text-red-300 hover:bg-red-900/50 text-sm font-medium transition-colors disabled:opacity-40"
                    onClick={() => reject(p.id)}
                    disabled={actionLoading === p.id + '-reject'}>
                    <X size={13}/>{actionLoading === p.id + '-reject' ? '...' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="card divide-y divide-zinc-800">
          {(pocket.members ?? []).map((m: any) => (
            <div key={m.id ?? m.userId} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-white">{m.email ?? m.userId}</p>
                {m.spendLimitUsd !== null && m.spendLimitUsd !== undefined && (
                  <p className="text-xs text-zinc-500 mt-0.5">Daily limit: {formatUsd(m.spendLimitUsd)}</p>
                )}
              </div>
              <span className={cn('badge', ROLE_STYLES[m.role] ?? ROLE_STYLES.viewer)}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Audit tab */}
      {tab === 'audit' && (
        <div className="card divide-y divide-zinc-800">
          {audit.length === 0 && <p className="text-zinc-500 text-sm text-center p-8">No audit entries yet</p>}
          {audit.map((e: any) => (
            <div key={e.id} className="flex items-start gap-3 p-4">
              <Shield size={14} className="text-zinc-600 mt-0.5 shrink-0"/>
              <div className="flex-1">
                <p className="text-sm text-zinc-300">{e.description}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{e.actorEmail} · {timeAgo(e.ts)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add member modal */}
      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add member">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
            <input className="input text-sm" placeholder="member@example.com"
              value={memberForm.email} onChange={e => setMemberForm(f => ({...f, email: e.target.value}))} autoFocus/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Role</label>
              <select className="input text-sm" value={memberForm.role} onChange={e => setMemberForm(f => ({...f, role: e.target.value}))}>
                <option value="signer">Signer</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Daily limit (USD)</label>
              <input className="input text-sm" type="number" placeholder="unlimited"
                value={memberForm.limit} onChange={e => setMemberForm(f => ({...f, limit: e.target.value}))}/>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-ghost flex-1" onClick={() => setShowAddMember(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={addMember}>Add</button>
          </div>
        </div>
      </Modal>

      {/* Propose modal */}
      <Modal open={showPropose} onClose={() => setShowPropose(false)} title="New proposal">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Title</label>
            <input className="input text-sm" placeholder="e.g. Pay vendor invoice"
              value={propForm.title} onChange={e => setPropForm(f => ({...f, title: e.target.value}))} autoFocus/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Amount</label>
              <input className="input text-sm" type="number" placeholder="0.0"
                value={propForm.amount} onChange={e => setPropForm(f => ({...f, amount: e.target.value}))}/>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Token</label>
              <select className="input text-sm" value={propForm.token} onChange={e => setPropForm(f => ({...f, token: e.target.value}))}>
                {['SOL','USDC','USDT','BONK','JUP'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Recipient address</label>
            <input className="input font-mono text-sm" placeholder="Solana address"
              value={propForm.to} onChange={e => setPropForm(f => ({...f, to: e.target.value}))}/>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Memo (optional)</label>
            <input className="input text-sm" placeholder="Invoice #123"
              value={propForm.memo} onChange={e => setPropForm(f => ({...f, memo: e.target.value}))}/>
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-ghost flex-1" onClick={() => setShowPropose(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={createProposal}>Submit proposal</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
