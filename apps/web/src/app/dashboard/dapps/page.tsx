'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Link2, Link2Off, QrCode, Shield, Clock, Check, X, ExternalLink } from 'lucide-react'
import { cn, timeAgo, truncateAddress } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const POPULAR_DAPPS = [
  { name: 'Jupiter', url: 'https://jup.ag', icon: '⚡', description: 'Best-price token swaps' },
  { name: 'Orca',    url: 'https://orca.so', icon: '🐋', description: 'CLMM liquidity pools' },
  { name: 'Raydium', url: 'https://raydium.io', icon: '⚡', description: 'AMM + concentrated liquidity' },
  { name: 'Magic Eden', url: 'https://magiceden.io', icon: '🪄', description: 'NFT marketplace' },
  { name: 'Tensor', url: 'https://tensor.trade', icon: '🔷', description: 'NFT trading' },
  { name: 'Marginfi', url: 'https://app.marginfi.com', icon: '💰', description: 'Lending & borrowing' },
  { name: 'Drift',   url: 'https://drift.trade', icon: '📈', description: 'Perpetual futures' },
  { name: 'Kamino',  url: 'https://kamino.finance', icon: '🌊', description: 'Automated liquidity' },
]

export default function DappsPage() {
  const [sessions, setSessions]   = useState<any[]>([])
  const [requests, setRequests]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showConnect, setShowConnect] = useState(false)
  const [uri, setUri]             = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectResult, setConnectResult] = useState<any>(null)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [walletAddress, setWalletAddress] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        authFetch('/dapps/sessions'),
        authFetch('/dapps/requests'),
      ])
      setSessions(s.data?.sessions ?? [])
      setRequests(r.data?.requests ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleConnect() {
    if (!uri.trim()) return
    setConnecting(true)
    try {
      const r = await authFetch('/dapps/connect', {
        method: 'POST',
        body: JSON.stringify({ uri: uri.trim(), walletAddress }),
      })
      if (r.error) { alert(r.error.message); return }
      setConnectResult(r.data)
    } finally { setConnecting(false) }
  }

  async function approveConnect(requestId: string) {
    if (!walletAddress.trim()) { alert('Enter your wallet address'); return }
    const r = await authFetch(`/dapps/connect/approve/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress, permissions: ['sign_transaction', 'sign_message'] }),
    })
    if (r.error) { alert(r.error.message); return }
    setConnectResult(null); setShowConnect(false); setUri('')
    load()
  }

  async function disconnect(sessionId: string) {
    if (!confirm('Disconnect this dApp?')) return
    await authFetch(`/dapps/sessions/${sessionId}`, { method: 'DELETE' })
    load()
  }

  async function approveRequest(requestId: string) {
    await authFetch(`/dapps/requests/approve/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ signedResult: 'SIGNED_BY_CLIENT' }),
    })
    setSelectedRequest(null); load()
  }

  async function rejectRequest(requestId: string) {
    await authFetch(`/dapps/requests/reject/${requestId}`, { method: 'POST' })
    setSelectedRequest(null); load()
  }

  return (
    <div>
      <TopBar title="dApps" actions={
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowConnect(true)}>
          <Link2 size={15}/> Connect dApp
        </button>
      } />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : (
        <div className="space-y-8">

          {/* Pending requests badge */}
          {requests.length > 0 && (
            <div className="card border-yellow-800 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Clock size={16} className="text-yellow-400" />
                <span className="font-semibold text-white">{requests.length} pending request{requests.length > 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {requests.map(req => (
                  <div key={req.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-white capitalize">{req.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-zinc-500">{(req.payload as any)?.dappOrigin ?? 'Unknown dApp'} · {timeAgo(req.ts)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-900/40 text-green-300 text-xs font-medium hover:bg-green-900/60 transition-colors" onClick={() => approveRequest(req.id)}>
                        <Check size={11}/> Approve
                      </button>
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-900/40 text-red-300 text-xs font-medium hover:bg-red-900/60 transition-colors" onClick={() => rejectRequest(req.id)}>
                        <X size={11}/> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected sessions */}
          {sessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Connected</h2>
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.iconUrl
                        ? <img src={s.iconUrl} alt={s.name} className="w-8 h-8 rounded-lg" />
                        : <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center"><Link2 size={14} className="text-zinc-400"/></div>
                      }
                      <div>
                        <p className="text-sm font-semibold text-white">{s.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{truncateAddress(s.accounts[0] ?? '', 6)} · {timeAgo(s.connectedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {s.permissions.map((p: string) => (
                          <span key={p} className="badge bg-zinc-800 text-zinc-500 text-xs">{p.split(':')[1]}</span>
                        ))}
                      </div>
                      <button className="text-zinc-600 hover:text-red-400 p-1.5 transition-colors" onClick={() => disconnect(s.id)}>
                        <Link2Off size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Popular dApps */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Popular Solana dApps</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {POPULAR_DAPPS.map(app => (
                <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer"
                  className="card p-4 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{app.icon}</span>
                    <span className="font-semibold text-white text-sm">{app.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{app.description}</p>
                  <div className="flex items-center gap-1 text-xs text-zinc-600 mt-2">
                    <ExternalLink size={10}/> Open
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Connect modal */}
      <Modal open={showConnect} onClose={() => { setShowConnect(false); setConnectResult(null); setUri('') }} title="Connect dApp">
        <div className="space-y-4">
          {!connectResult ? (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">WalletConnect or Solana Wallet URI</label>
                <textarea className="input text-sm font-mono text-xs resize-none h-20"
                  placeholder="wc:abc123@2?relay-protocol=irn&symKey=..." value={uri}
                  onChange={e => setUri(e.target.value)} />
                <p className="text-xs text-zinc-600 mt-1">Paste the URI from the dApp's connect screen.</p>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Connect with wallet address</label>
                <input className="input font-mono text-sm" placeholder="Your Solana address"
                  value={walletAddress} onChange={e => setWalletAddress(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-1">
                <button className="btn-ghost flex-1" onClick={() => setShowConnect(false)}>Cancel</button>
                <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleConnect} disabled={connecting || !uri.trim()}>
                  <Link2 size={14}/>{connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-xl p-4 text-center">
                <Shield size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">Approve connection</p>
                <p className="text-xs text-zinc-500 mt-1">A dApp wants to connect to your Clutch wallet</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Type</span><span className="text-zinc-300 capitalize">{connectResult.type?.replace('-', ' ')}</span></div>
                {connectResult.topic && <div className="flex justify-between"><span className="text-zinc-500">Topic</span><span className="text-zinc-300 font-mono">{connectResult.topic.slice(0,16)}...</span></div>}
                {connectResult.appUrl && <div className="flex justify-between"><span className="text-zinc-500">App</span><span className="text-zinc-300">{connectResult.appUrl}</span></div>}
              </div>
              <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-3 text-xs text-yellow-300">
                Only connect to dApps you trust. Connected dApps can request transaction signatures.
              </div>
              <div className="flex gap-3 pt-1">
                <button className="btn-ghost flex-1" onClick={() => setConnectResult(null)}>Back</button>
                <button className="btn-primary flex-1" onClick={() => approveConnect(connectResult.requestId)}>
                  Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
