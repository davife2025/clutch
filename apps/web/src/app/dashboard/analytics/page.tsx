'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { TrendingUp, TrendingDown, Download, RefreshCw } from 'lucide-react'
import { formatUsd } from '@/lib/utils'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

function MiniChart({ points }: { points: { ts: string; totalUsd: number }[] }) {
  if (points.length < 2) return <div className="h-24 flex items-center justify-center text-zinc-600 text-sm">Not enough data yet</div>

  const max = Math.max(...points.map(p => p.totalUsd))
  const min = Math.min(...points.map(p => p.totalUsd))
  const range = max - min || 1
  const w = 600
  const h = 96

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - ((p.totalUsd - min) / range) * (h - 10) - 5
    return `${x},${y}`
  })

  const isUp = points[points.length - 1].totalUsd >= points[0].totalUsd
  const color = isUp ? '#22c55e' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 96 }}>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AnalyticsPage() {
  const [pockets, setPockets]   = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [report, setReport]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [snapping, setSnapping]   = useState(false)

  useEffect(() => {
    authFetch('/pockets').then(r => {
      const ps = r.data?.pockets ?? []
      setPockets(ps)
      if (ps.length > 0) setSelected(ps[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const loadReport = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await authFetch(`/analytics/${selected}/report`)
      setReport(r.data?.report ?? null)
    } finally { setLoading(false) }
  }, [selected])

  useEffect(() => { if (selected) loadReport() }, [selected, loadReport])

  async function takeSnapshot() {
    setSnapping(true)
    await authFetch(`/analytics/${selected}/snapshot`, { method: 'POST' })
    await loadReport()
    setSnapping(false)
  }

  async function exportCsv() {
    setExporting(true)
    const token = localStorage.getItem('clutch_token')
    const res = await fetch(`${API}/analytics/${selected}/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `clutch-transactions.csv`; a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const PNL_PERIOD_LABELS: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', 'all': 'All time' }

  return (
    <div>
      <TopBar title="Analytics" actions={
        <div className="flex gap-2">
          {selected && <button className="btn-ghost flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={takeSnapshot} disabled={snapping}>
            <RefreshCw size={13} className={snapping ? 'animate-spin' : ''} />{snapping ? 'Snapping...' : 'Snapshot'}
          </button>}
          {selected && <button className="btn-ghost flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={exportCsv} disabled={exporting}>
            <Download size={13} />{exporting ? 'Exporting...' : 'Export CSV'}
          </button>}
        </div>
      } />

      {/* Pocket selector */}
      {pockets.length > 1 && (
        <div className="flex gap-2 mb-6">
          {pockets.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selected === p.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : !report ? (
        <div className="card p-10 text-center text-zinc-500">No analytics data yet — sync your balances to get started.</div>
      ) : (
        <div className="space-y-6">

          {/* Total + chart */}
          <div className="card p-6">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Portfolio value</p>
            <p className="text-4xl font-bold text-white mb-1">{formatUsd(report.totalUsd)}</p>
            <p className="text-xs text-zinc-500">{report.nativeSolBalance} SOL native · Generated {new Date(report.generatedAt).toLocaleTimeString()}</p>
            <div className="mt-4">
              <MiniChart points={report.history} />
            </div>
          </div>

          {/* P&L */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Profit / loss</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(report.pnl ?? []).map((p: any) => (
                <div key={p.period} className="card p-4">
                  <p className="text-xs text-zinc-500 mb-2">{PNL_PERIOD_LABELS[p.period]}</p>
                  <p className={cn('text-lg font-bold', p.changeUsd >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {p.changeUsd >= 0 ? '+' : ''}{formatUsd(p.changeUsd)}
                  </p>
                  <div className={cn('flex items-center gap-1 text-xs mt-1', p.changePct >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {p.changePct >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                    {Math.abs(p.changePct).toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token breakdown */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Token allocation</h2>
            <div className="card divide-y divide-zinc-800">
              {report.breakdown.length === 0 && (
                <p className="text-zinc-500 text-sm p-6 text-center">No token balances found</p>
              )}
              {report.breakdown.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                    {t.token.slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{t.token}</span>
                      <span className="text-sm font-semibold text-white">{formatUsd(t.usdValue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 mr-3">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(t.percentage, 100)}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 w-12 text-right">{t.percentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">{t.amount.toFixed(4)} · {t.chain}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
