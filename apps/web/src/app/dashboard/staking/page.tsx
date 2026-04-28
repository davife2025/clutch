'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { ExternalLink, TrendingUp, Shield, Zap } from 'lucide-react'
import { formatUsd, cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

export default function StakingPage() {
  const [pockets, setPockets]         = useState<any[]>([])
  const [selected, setSelected]       = useState<string>('')
  const [portfolio, setPortfolio]     = useState<any>(null)
  const [validators, setValidators]   = useState<any[]>([])
  const [liquidOptions, setLiquid]    = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<'overview'|'validators'|'liquid'>('overview')

  useEffect(() => {
    Promise.all([
      authFetch('/pockets').then(r => {
        const ps = r.data?.pockets ?? []
        setPockets(ps)
        if (ps.length > 0) setSelected(ps[0].id)
      }),
      authFetch('/staking/validators?limit=20').then(r => setValidators(r.data?.validators ?? [])),
      authFetch('/staking/liquid-options').then(r => setLiquid(r.data?.options ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  const loadPortfolio = useCallback(async () => {
    if (!selected) return
    const r = await authFetch(`/staking/${selected}/portfolio`)
    setPortfolio(r.data ?? null)
  }, [selected])

  useEffect(() => { loadPortfolio() }, [loadPortfolio])

  const totalStaked = portfolio?.totalStakedSOL ?? 0
  const allPortfolios: any[] = portfolio?.portfolios ?? []
  const totalLiquid = allPortfolios.reduce((s: number, p: any) => s + (p.totalLiquidSOL ?? 0), 0)
  const totalNative = allPortfolios.reduce((s: number, p: any) => s + (p.totalNativeStakedSOL ?? 0), 0)
  const avgApy      = allPortfolios.length > 0
    ? allPortfolios.reduce((s: number, p: any) => s + (p.combinedApy ?? 0), 0) / allPortfolios.length
    : 0

  return (
    <div>
      <TopBar title="Staking" />

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
      ) : (
        <div className="space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <p className="text-2xl font-bold text-white">{totalStaked.toFixed(3)}</p>
              <p className="text-xs text-zinc-500 mt-1">Total SOL staked</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-2xl font-bold text-green-400">{avgApy.toFixed(2)}%</p>
              <p className="text-xs text-zinc-500 mt-1">Avg APY</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-2xl font-bold text-white">
                {(totalStaked * (avgApy / 100)).toFixed(4)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Est. yearly rewards (SOL)</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl w-fit">
            {(['overview', 'validators', 'liquid'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                  activeTab === tab ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                {tab === 'liquid' ? 'Liquid staking' : tab}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {allPortfolios.length === 0 ? (
                <div className="card p-10 text-center">
                  <Shield size={32} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-1">No staked SOL detected</p>
                  <p className="text-zinc-600 text-sm">Stake SOL via a validator or liquid staking protocol to earn rewards.</p>
                </div>
              ) : (
                allPortfolios.map((p: any, i: number) => (
                  <div key={i} className="card p-5">
                    <p className="text-xs text-zinc-500 font-mono mb-3">{p.walletAddress}</p>

                    {p.nativeStakeAccounts?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Native stake accounts</p>
                        <div className="space-y-2">
                          {p.nativeStakeAccounts.map((acc: any) => (
                            <div key={acc.address} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                              <div>
                                <p className="text-xs font-mono text-zinc-300">{acc.address.slice(0,12)}...</p>
                                <p className="text-xs text-zinc-500 mt-0.5">Validator: {acc.voter.slice(0,8)}... · {acc.state}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-white">
                                  {(Number(acc.stake) / 1e9).toFixed(3)} SOL
                                </p>
                                <span className={cn('badge text-xs',
                                  acc.state === 'active' ? 'bg-green-900 text-green-300' :
                                  acc.state === 'activating' ? 'bg-yellow-900 text-yellow-300' :
                                  'bg-zinc-800 text-zinc-400')}>
                                  {acc.state}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.liquidPositions?.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Liquid positions</p>
                        {p.liquidPositions.map((pos: any) => (
                          <div key={pos.token} className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3">
                            <span className="text-sm font-semibold text-white">{pos.token}</span>
                            <span className="text-sm text-white">{pos.amount.toFixed(4)} ≈ {pos.valueSOL.toFixed(3)} SOL</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Validators */}
          {activeTab === 'validators' && (
            <div className="card divide-y divide-zinc-800">
              {validators.slice(0, 20).map((v: any, i: number) => (
                <div key={v.voteAccount} className="flex items-center gap-4 p-4">
                  <span className="text-zinc-600 text-sm w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{v.name}</p>
                    <p className="text-xs text-zinc-500 font-mono">{v.voteAccount.slice(0,12)}...</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-green-400">{(v.apy ?? 6.5).toFixed(2)}% APY</p>
                    <p className="text-xs text-zinc-500">{v.commission}% fee</p>
                  </div>
                  {v.delinquent && <span className="badge bg-red-900 text-red-300 text-xs">offline</span>}
                </div>
              ))}
            </div>
          )}

          {/* Liquid staking */}
          {activeTab === 'liquid' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {liquidOptions.map((opt: any) => (
                <div key={opt.token} className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} className="text-green-400" />
                    <span className="font-semibold text-white">{opt.protocol}</span>
                  </div>
                  <p className="text-3xl font-bold text-green-400 mb-1">{opt.apy.toFixed(2)}%</p>
                  <p className="text-xs text-zinc-500 mb-3">APY in {opt.token}</p>
                  <div className="space-y-1.5 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">You receive</span>
                      <span className="text-white">{opt.token}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Exchange rate</span>
                      <span className="text-white">1 {opt.token} = {opt.exchangeRate.toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">TVL</span>
                      <span className="text-white">{(opt.tvlSOL / 1e6).toFixed(1)}M SOL</span>
                    </div>
                  </div>
                  <a href={opt.depositUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-primary w-full text-center text-sm flex items-center justify-center gap-2">
                    Stake on {opt.protocol.split(' ')[0]} <ExternalLink size={12}/>
                  </a>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
