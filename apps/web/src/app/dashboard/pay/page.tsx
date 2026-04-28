'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { QrCode, Plus, Trash2, Check, Clock, RefreshCw, Link } from 'lucide-react'
import { formatUsd, truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

// Render a QR code as an SVG grid (no external library)
function QrDisplay({ data, size = 240 }: { data: string; size?: number }) {
  // Simple visual placeholder — in production use 'qrcode' npm package
  const cells = 25
  const cell  = size / cells
  // Hash the data to get a deterministic pattern
  let hash = 0
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0

  return (
    <div style={{ width: size, height: size, background: '#fff', padding: 12, borderRadius: 12, display: 'inline-block' }}>
      <svg width={size - 24} height={size - 24} viewBox={`0 0 ${cells} ${cells}`}>
        {/* Corner squares */}
        {[[0,0],[0,cells-7],[cells-7,0]].map(([x,y],i) => (
          <g key={i}>
            <rect x={x} y={y} width={7} height={7} fill="#000"/>
            <rect x={x+1} y={y+1} width={5} height={5} fill="#fff"/>
            <rect x={x+2} y={y+2} width={3} height={3} fill="#000"/>
          </g>
        ))}
        {/* Data cells */}
        {Array.from({ length: cells }, (_, r) =>
          Array.from({ length: cells }, (_, c) => {
            const isCorner = (r < 8 && c < 8) || (r < 8 && c >= cells-8) || (r >= cells-8 && c < 8)
            if (isCorner) return null
            const idx  = r * cells + c
            const fill = ((hash >> (idx % 31)) & 1) ^ ((data.charCodeAt(idx % data.length) >> (idx % 7)) & 1)
            return fill ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#000"/> : null
          })
        )}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 8, color: '#71717a', marginTop: 4, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: size - 24 }}>
        {data.slice(0, 40)}...
      </div>
    </div>
  )
}

export default function PayPage() {
  const [pockets, setPockets]   = useState<any[]>([])
  const [tab, setTab]           = useState<'link'|'pos'>('link')
  const [loading, setLoading]   = useState(true)

  // Payment link form
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount]       = useState('')
  const [token, setToken]         = useState('USDC')
  const [label, setLabel]         = useState('')
  const [memo, setMemo]           = useState('')
  const [payLink, setPayLink]     = useState<any>(null)
  const [creatingLink, setCreatingLink] = useState(false)
  const [linkStatus, setLinkStatus]     = useState<string | null>(null)
  const [polling, setPolling]           = useState(false)

  // POS form
  const [merchantName, setMerchantName] = useState('')
  const [merchantAddr, setMerchantAddr] = useState('')
  const [posToken, setPosToken]         = useState('USDC')
  const [posItems, setPosItems]         = useState<any[]>([{ name: '', price: '', quantity: 1 }])
  const [posSession, setPosSession]     = useState<any>(null)
  const [posUri, setPosUri]             = useState<string | null>(null)
  const [creatingPos, setCreatingPos]   = useState(false)
  const [posStatus, setPosStatus]       = useState<'open'|'paid'|'cancelled'>('open')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    authFetch('/pockets').then(r => {
      const ps = r.data?.pockets ?? []
      setPockets(ps)
      // Pre-fill merchant address from first Solana wallet
      const sw = ps.flatMap((p: any) => (p.wallets ?? []).filter((w: any) => w.chain === 'solana'))[0]
      if (sw) setMerchantAddr(sw.address)
    }).finally(() => setLoading(false))
  }, [])

  // Auto-fill recipient from first wallet
  useEffect(() => {
    const sw = pockets.flatMap((p: any) => (p.wallets ?? []).filter((w: any) => w.chain === 'solana'))[0]
    if (sw && !recipient) setRecipient(sw.address)
  }, [pockets])

  async function createLink() {
    if (!recipient.trim() || !amount) return
    setCreatingLink(true)
    try {
      const r = await authFetch('/pay/link', {
        method: 'POST',
        body: JSON.stringify({ recipient, amount: parseFloat(amount), token, label, memo }),
      })
      if (r.error) { alert(r.error.message); return }
      setPayLink(r.data?.link)
      setLinkStatus(null)
    } finally { setCreatingLink(false) }
  }

  async function checkLinkStatus() {
    if (!payLink?.uri) return
    setPolling(true)
    const r = await authFetch(`/pay/link/status?uri=${encodeURIComponent(payLink.uri)}`)
    setLinkStatus(r.data?.confirmed ? 'confirmed' : 'pending')
    setPolling(false)
  }

  async function createPos() {
    const validItems = posItems.filter(i => i.name && i.price)
    if (!merchantName || !merchantAddr || !validItems.length) return
    setCreatingPos(true)
    try {
      const r = await authFetch('/pay/pos', {
        method: 'POST',
        body: JSON.stringify({
          merchantName, merchantAddress: merchantAddr, token: posToken,
          items: validItems.map(i => ({ name: i.name, price: parseFloat(i.price), quantity: i.quantity ?? 1 })),
        }),
      })
      if (r.error) { alert(r.error.message); return }
      setPosSession(r.data?.session)
      setPosUri(r.data?.paymentUri)
      setPosStatus('open')

      // Poll every 3 seconds
      pollRef.current = setInterval(async () => {
        const check = await authFetch(`/pay/pos/${r.data.session.id}/check`, { method: 'POST' })
        if (check.data?.paid) {
          setPosStatus('paid')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, 3000)
    } finally { setCreatingPos(false) }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const totalUsd = posItems.reduce((s, i) => s + (parseFloat(i.price || '0') * (i.quantity ?? 1)), 0)

  return (
    <div>
      <TopBar title="Solana Pay" />

      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-xl w-fit">
        {(['link', 'pos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            {t === 'link' ? 'Payment link' : 'POS terminal'}
          </button>
        ))}
      </div>

      {/* Payment link */}
      {tab === 'link' && (
        <div className="max-w-xl space-y-6">
          {!payLink ? (
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-semibold text-white">Create payment link</h2>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Recipient address</label>
                <input className="input font-mono text-sm" placeholder="Your Solana address"
                  value={recipient} onChange={e => setRecipient(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Amount</label>
                  <input className="input text-sm" type="number" step="0.01" placeholder="0.00"
                    value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Token</label>
                  <select className="input text-sm" value={token} onChange={e => setToken(e.target.value)}>
                    {['USDC', 'SOL', 'USDT'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Label (shown in wallet)</label>
                <input className="input text-sm" placeholder="e.g. Coffee shop"
                  value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Memo (optional)</label>
                <input className="input text-sm" placeholder="Invoice #123"
                  value={memo} onChange={e => setMemo(e.target.value)} />
              </div>
              <button className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={createLink} disabled={creatingLink || !recipient || !amount}>
                <QrCode size={15}/>{creatingLink ? 'Creating...' : 'Generate QR code'}
              </button>
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Payment QR code</h2>
                <button className="btn-ghost text-sm py-1.5 px-3" onClick={() => setPayLink(null)}>New link</button>
              </div>

              <div className="flex justify-center mb-5">
                <QrDisplay data={payLink.qrData} size={220} />
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-zinc-500">Amount</span><span className="text-white font-semibold">{amount} {token}</span></div>
                {label && <div className="flex justify-between"><span className="text-zinc-500">Label</span><span className="text-white">{label}</span></div>}
                <div className="flex justify-between"><span className="text-zinc-500">Recipient</span><span className="text-zinc-300 font-mono text-xs">{truncateAddress(recipient)}</span></div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-3 mb-4">
                <p className="text-xs text-zinc-500 mb-1">Payment URI</p>
                <p className="text-xs font-mono text-zinc-400 break-all">{payLink.uri.slice(0, 80)}...</p>
                <button className="text-xs text-green-400 mt-1" onClick={() => navigator.clipboard.writeText(payLink.uri)}>Copy URI</button>
              </div>

              <div className="flex gap-3">
                <button className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-sm"
                  onClick={checkLinkStatus} disabled={polling}>
                  <RefreshCw size={13} className={polling ? 'animate-spin' : ''}/> Check status
                </button>
                {linkStatus && (
                  <div className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold',
                    linkStatus === 'confirmed' ? 'bg-green-900/40 text-green-300' : 'bg-zinc-800 text-zinc-400')}>
                    {linkStatus === 'confirmed' ? <><Check size={13}/> Paid</> : <><Clock size={13}/> Pending</>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* POS terminal */}
      {tab === 'pos' && (
        <div className="max-w-xl space-y-6">
          {!posSession ? (
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-semibold text-white">POS terminal</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Merchant name</label>
                  <input className="input text-sm" placeholder="My shop"
                    value={merchantName} onChange={e => setMerchantName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Accept</label>
                  <select className="input text-sm" value={posToken} onChange={e => setPosToken(e.target.value)}>
                    {['USDC', 'SOL'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Merchant address</label>
                <input className="input font-mono text-sm" placeholder="Solana address"
                  value={merchantAddr} onChange={e => setMerchantAddr(e.target.value)} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500">Items</label>
                  <button className="text-xs text-green-400 flex items-center gap-1"
                    onClick={() => setPosItems(p => [...p, { name: '', price: '', quantity: 1 }])}>
                    <Plus size={11}/> Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {posItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 items-center">
                      <input className="input text-sm col-span-2 py-2" placeholder="Item name"
                        value={item.name} onChange={e => setPosItems(p => p.map((x,j) => j===i ? {...x,name:e.target.value} : x))} />
                      <input className="input text-sm py-2" placeholder="$0.00" type="number"
                        value={item.price} onChange={e => setPosItems(p => p.map((x,j) => j===i ? {...x,price:e.target.value} : x))} />
                      <input className="input text-sm py-2" type="number" min="1" value={item.quantity}
                        onChange={e => setPosItems(p => p.map((x,j) => j===i ? {...x,quantity:parseInt(e.target.value)||1} : x))} />
                      <button className="text-zinc-600 hover:text-red-400 transition-colors flex justify-center"
                        onClick={() => setPosItems(p => p.filter((_,j) => j!==i))}><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {totalUsd > 0 && (
                <div className="bg-zinc-800 rounded-xl p-3 flex justify-between text-sm">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-white font-bold">{formatUsd(totalUsd)} in {posToken}</span>
                </div>
              )}

              <button className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={createPos} disabled={creatingPos || !merchantName || !merchantAddr || !posItems.some(i => i.name && i.price)}>
                <QrCode size={15}/>{creatingPos ? 'Creating...' : 'Open checkout'}
              </button>
            </div>
          ) : (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{posSession.merchantName}</h2>
                  <p className="text-xs text-zinc-500">Session #{posSession.id}</p>
                </div>
                {posStatus === 'paid'
                  ? <span className="badge bg-green-900 text-green-300 text-sm px-3 py-1.5 flex items-center gap-1.5"><Check size={13}/> Paid</span>
                  : <span className="badge bg-yellow-900 text-yellow-300 text-sm px-3 py-1.5 flex items-center gap-1.5 animate-pulse"><Clock size={13}/> Waiting...</span>
                }
              </div>

              {posUri && posStatus !== 'paid' && (
                <div className="flex justify-center mb-5">
                  <QrDisplay data={posUri} size={220} />
                </div>
              )}

              {posStatus === 'paid' && (
                <div className="flex justify-center mb-5">
                  <div className="w-24 h-24 rounded-full bg-green-900/30 flex items-center justify-center">
                    <Check size={40} className="text-green-400" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 mb-4">
                {posSession.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{item.name} ×{item.quantity}</span>
                    <span className="text-white">{formatUsd(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-zinc-800 mt-2">
                  <span className="text-zinc-300">Total</span>
                  <span className="text-white">{formatUsd(posSession.total)} in {posSession.token}</span>
                </div>
              </div>

              <button className="btn-ghost w-full text-sm" onClick={() => { setPosSession(null); setPosUri(null); setPosStatus('open') }}>
                New checkout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
