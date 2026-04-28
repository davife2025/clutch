'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { formatUsd } from '@/lib/utils'
import { TrendingUp, TrendingDown, Zap, ArrowLeftRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  }).then((r) => r.json())
}

const TOKENS = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'RAY', 'WIF', 'ORCA']

export default function DeFiPage() {
  const [metrics, setMetrics] = useState<any[]>([])
  const [yields, setYields]   = useState<any[]>([])
  const [gas, setGas]         = useState<any>(null)
  const [quote, setQuote]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ql, setQl]           = useState(false)
  const [from, setFrom]       = useState('SOL')
  const [to, setTo]           = useState('USDC')
  const [amount, setAmount]   = useState('1')
  const [alerts, setAlerts]   = useState<any[]>([])
  const [alertToken, setAlertToken] = useState('SOL')
  const [alertDir, setAlertDir]     = useState('above')
  const [alertPrice, setAlertPrice] = useState('')

  useEffect(() => {
    Promise.all([
      authFetch('/defi/metrics?tokens=SOL,USDC,BONK,JUP,RAY,WIF').then((r) => setMetrics(r.data?.metrics ?? [])),
      authFetch('/defi/yield').then((r) => setYields(r.data?.opportunities ?? [])),
      authFetch('/defi/gas').then((r) => setGas(r.data?.fee)),
      authFetch('/defi/alerts').then((r) => setAlerts(r.data?.alerts ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  async function getQuote() {
    setQl(true)
    try {
      const r = await authFetch(`/defi/quote?from=${from}&to=${to}&amount=${amount}`)
      setQuote(r.data?.quote)
    } finally { setQl(false) }
  }

  async function createAlert() {
    if (!alertPrice) return
    const r = await authFetch('/defi/alerts', {
      method: 'POST',
      body: JSON.stringify({ token: alertToken, direction: alertDir, targetUsd: parseFloat(alertPrice) }),
    })
    if (r.data?.alert) { setAlerts((p) => [...p, r.data.alert]); setAlertPrice('') }
  }

  async function deleteAlert(id: string) {
    await authFetch(`/defi/alerts/${id}`, { method: 'DELETE' })
    setAlerts((p) => p.filter((a) => a.id !== id))
  }

  if (loading) return <div><TopBar title="DeFi" /><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></div>

  return (
    <div>
      <TopBar title="DeFi" />
      <div className="space-y-8">

        {/* Market */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Market</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.token} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{m.token}</span>
                  <span className={`text-xs font-semibold flex items-center gap-1 ${(m.change24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(m.change24h ?? 0) >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                    {Math.abs(m.change24h ?? 0).toFixed(2)}%
                  </span>
                </div>
                <p className="text-xl font-bold text-white">{formatUsd(m.priceUsd)}</p>
                {m.volumeUsd24h && <p className="text-xs text-zinc-500 mt-1">Vol {formatUsd(m.volumeUsd24h)}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Gas */}
        {gas && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Network fee</h2>
            <div className="card p-4 flex items-center gap-4">
              <Zap size={18} className={gas.congestion === 'low' ? 'text-green-400' : gas.congestion === 'medium' ? 'text-yellow-400' : 'text-red-400'} />
              <div className="flex-1">
                <p className="text-white font-semibold">{gas.totalFeeSol} SOL per transaction</p>
                <p className="text-zinc-500 text-xs">{gas.totalFeeUsd ? `~${formatUsd(gas.totalFeeUsd)}` : ''} · {gas.congestion} congestion</p>
              </div>
              <span className={`badge ${gas.congestion === 'low' ? 'bg-green-900 text-green-300' : gas.congestion === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>{gas.congestion}</span>
            </div>
          </div>
        )}

        {/* Swap */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Swap via Jupiter</h2>
          <div className="card p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">From</label>
                <select className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {TOKENS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Amount</label>
                <input className="input text-sm" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">To</label>
                <select className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
                  {TOKENS.filter((t) => t !== from).map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={getQuote} disabled={ql}>
              <ArrowLeftRight size={15}/>{ql ? 'Getting quote...' : 'Get quote'}
            </button>
            {quote && (
              <div className="mt-4 bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">You receive</span><span className="text-white font-semibold">{quote.outputAmount?.toFixed(6)} {quote.outputSymbol}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Min received</span><span className="text-zinc-300">{quote.minimumReceived?.toFixed(6)} {quote.outputSymbol}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Price impact</span><span className={quote.priceImpact > 1 ? 'text-red-400' : 'text-zinc-300'}>{quote.priceImpact?.toFixed(3)}%</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Route</span><span className="text-zinc-300 text-xs">{quote.route?.join(' → ')}</span></div>
                <p className="text-xs text-zinc-600 pt-1">Sign and broadcast via your connected Solana wallet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Yield */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Yield opportunities</h2>
          <div className="space-y-2">
            {yields.slice(0, 8).map((y, i) => (
              <a key={i} href={y.url} target="_blank" rel="noopener noreferrer"
                className="card p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors block">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{y.token}</span>
                    <span className="badge bg-zinc-800 text-zinc-400">{y.protocol}</span>
                    <span className="badge bg-zinc-800 text-zinc-400">{y.type}</span>
                    <span className={`badge ${y.risk === 'low' ? 'bg-green-900 text-green-300' : y.risk === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>{y.risk}</span>
                  </div>
                  {y.tvlUsd > 0 && <p className="text-xs text-zinc-500">TVL {formatUsd(y.tvlUsd)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">{y.apy.toFixed(2)}%</p>
                  <p className="text-xs text-zinc-500">APY</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Price alerts</h2>
          <div className="card p-5">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Token</label>
                <select className="input text-sm" value={alertToken} onChange={(e) => setAlertToken(e.target.value)}>
                  {TOKENS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Direction</label>
                <select className="input text-sm" value={alertDir} onChange={(e) => setAlertDir(e.target.value)}>
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Target USD</label>
                <input className="input text-sm" type="number" placeholder="0.00" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button className="btn-primary w-full text-sm" onClick={createAlert}>+ Alert</button>
              </div>
            </div>
            {alerts.length === 0
              ? <p className="text-zinc-500 text-sm text-center py-4">No alerts yet</p>
              : alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3 mb-2">
                    <span className="text-sm text-white">{a.token} {a.direction} {formatUsd(a.targetUsd)}</span>
                    <button onClick={() => deleteAlert(a.id)} className="text-zinc-600 hover:text-red-400 transition-colors">✕</button>
                  </div>
                ))
            }
          </div>
        </div>

      </div>
    </div>
  )
}
