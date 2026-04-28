'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { ArrowRight, RefreshCw, ExternalLink, Clock, Check, AlertCircle } from 'lucide-react'
import { formatUsd, cn, timeAgo } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const STATUS_STYLE: Record<string, { label: string; color: string; icon: any }> = {
  pending_source: { label: 'Waiting for source tx', color: 'text-yellow-400', icon: Clock },
  pending_vaa:    { label: 'Waiting for Wormhole Guardians', color: 'text-blue-400', icon: Clock },
  pending_target: { label: 'Ready to redeem', color: 'text-purple-400', icon: Clock },
  completed:      { label: 'Completed', color: 'text-green-400', icon: Check },
  failed:         { label: 'Failed', color: 'text-red-400', icon: AlertCircle },
  refunded:       { label: 'Refunded', color: 'text-zinc-400', icon: AlertCircle },
}

const CHAINS = ['solana','ethereum','base','polygon','arbitrum','optimism','bsc','avalanche']
const TOKENS: Record<string, string[]> = {
  solana:   ['SOL','USDC','USDT','BONK','JUP'],
  ethereum: ['ETH','USDC','USDT','WBTC'],
  base:     ['ETH','USDC','USDT'],
  polygon:  ['MATIC','USDC','USDT'],
  arbitrum: ['ETH','USDC','ARB'],
  optimism: ['ETH','USDC','OP'],
  bsc:      ['BNB','USDC','USDT'],
  avalanche:['AVAX','USDC','USDT'],
}

export default function BridgePage() {
  const [pockets, setPockets]   = useState<any[]>([])
  const [history, setHistory]   = useState<any[]>([])
  const [chains, setChains]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'bridge'|'history'>('bridge')

  // Form
  const [fromChain, setFromChain]   = useState('solana')
  const [toChain, setToChain]       = useState('ethereum')
  const [fromToken, setFromToken]   = useState('USDC')
  const [toToken, setToToken]       = useState('USDC')
  const [amount, setAmount]         = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [toAddress, setToAddress]   = useState('')

  // Quote
  const [quote, setQuote]       = useState<any>(null)
  const [quoting, setQuoting]   = useState(false)
  const [bridging, setBridging] = useState(false)
  const [bridgeResult, setBridgeResult] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      authFetch('/pockets').then(r => {
        const ps = r.data?.pockets ?? []
        setPockets(ps)
        const sw = ps.flatMap((p: any) => (p.wallets ?? []).filter((w: any) => w.chain === 'solana'))[0]
        if (sw) setFromAddress(sw.address)
      }),
      authFetch('/bridge/chains').then(r => setChains(r.data?.chains ?? [])),
      authFetch('/bridge/history').then(r => setHistory(r.data?.transfers ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  // Swap chains
  function swapChains() {
    setFromChain(toChain); setToChain(fromChain)
    setFromToken(toToken); setToToken(fromToken)
    setFromAddress(toAddress); setToAddress(fromAddress)
  }

  async function getQuote() {
    if (!amount || !fromChain || !toChain || !fromToken || !toToken) return
    setQuoting(true); setQuote(null)
    try {
      const r = await authFetch(`/bridge/quote?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`)
      setQuote(r.data?.best ?? null)
    } finally { setQuoting(false) }
  }

  async function initiateBridge() {
    if (!quote || !fromAddress || !toAddress) return
    setBridging(true)
    try {
      const r = await authFetch('/bridge/initiate', {
        method: 'POST',
        body: JSON.stringify({
          fromChain, toChain, fromToken, toToken,
          amount: parseFloat(amount), fromAddress, toAddress,
          protocol: quote.protocol,
        }),
      })
      if (r.error) { alert(r.error.message); return }
      setBridgeResult(r.data)
      // Refresh history
      const h = await authFetch('/bridge/history')
      setHistory(h.data?.transfers ?? [])
    } finally { setBridging(false) }
  }

  const fromTokens = TOKENS[fromChain] ?? ['USDC']
  const toTokens   = TOKENS[toChain]   ?? ['USDC']

  return (
    <div>
      <TopBar title="Bridge" />

      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-xl w-fit">
        {(['bridge','history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            {t}
            {t === 'history' && history.length > 0 && (
              <span className="ml-1.5 badge bg-zinc-700 text-zinc-300">{history.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : tab === 'bridge' ? (
        <div className="max-w-xl space-y-5">
          {!bridgeResult ? (
            <>
              {/* Chain selector */}
              <div className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1.5">From</label>
                    <select className="input text-sm capitalize" value={fromChain} onChange={e => { setFromChain(e.target.value); setFromToken(TOKENS[e.target.value]?.[0] ?? 'USDC') }}>
                      {CHAINS.filter(c => c !== toChain).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button onClick={swapChains} className="mt-5 w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors shrink-0">
                    <ArrowRight size={16} className="text-zinc-400"/>
                  </button>
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1.5">To</label>
                    <select className="input text-sm capitalize" value={toChain} onChange={e => { setToChain(e.target.value); setToToken(TOKENS[e.target.value]?.[0] ?? 'USDC') }}>
                      {CHAINS.filter(c => c !== fromChain).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1.5">Token</label>
                    <select className="input text-sm" value={fromToken} onChange={e => setFromToken(e.target.value)}>
                      {fromTokens.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1.5">Receive</label>
                    <select className="input text-sm" value={toToken} onChange={e => setToToken(e.target.value)}>
                      {toTokens.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-500 mb-1.5">Amount</label>
                    <input className="input text-sm" type="number" placeholder="0.00"
                      value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">From address</label>
                    <input className="input font-mono text-xs py-2" placeholder="Source address"
                      value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">To address</label>
                    <input className="input font-mono text-xs py-2" placeholder="Destination address"
                      value={toAddress} onChange={e => setToAddress(e.target.value)} />
                  </div>
                </div>

                <button className="btn-ghost w-full mt-3 flex items-center justify-center gap-2 text-sm"
                  onClick={getQuote} disabled={quoting || !amount}>
                  <RefreshCw size={13} className={quoting ? 'animate-spin' : ''}/>{quoting ? 'Getting quote...' : 'Get quote'}
                </button>
              </div>

              {/* Quote */}
              {quote && (
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Best route</span>
                    <span className="badge bg-zinc-800 text-zinc-400 capitalize">{quote.protocol}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{parseFloat(quote.fromAmount).toFixed(4)}</p>
                      <p className="text-xs text-zinc-500">{quote.fromToken} on {quote.fromChain}</p>
                    </div>
                    <ArrowRight size={16} className="text-zinc-500 shrink-0"/>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">{parseFloat(quote.toAmount).toFixed(4)}</p>
                      <p className="text-xs text-zinc-500">{quote.toToken} on {quote.toChain}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-zinc-800">
                    <div className="flex justify-between"><span className="text-zinc-500">Est. time</span><span className="text-zinc-300">{Math.ceil(quote.estimatedTimeMs / 60000)} min</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Network fee</span><span className="text-zinc-300">{quote.fee.networkFee} {quote.fromChain === 'solana' ? 'SOL' : 'ETH'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Bridge fee</span><span className="text-zinc-300">{quote.fee.bridgeFee} {quote.fromToken}</span></div>
                    {quote.priceImpact > 0 && <div className="flex justify-between"><span className="text-zinc-500">Price impact</span><span className={quote.priceImpact > 1 ? 'text-red-400' : 'text-zinc-300'}>{quote.priceImpact.toFixed(2)}%</span></div>}
                    <div className="flex justify-between"><span className="text-zinc-500">Route</span><span className="text-zinc-300">{quote.route.join(' → ')}</span></div>
                  </div>

                  {!fromAddress || !toAddress ? (
                    <p className="text-xs text-yellow-400">Enter source and destination addresses above to bridge.</p>
                  ) : (
                    <button className="btn-primary w-full flex items-center justify-center gap-2"
                      onClick={initiateBridge} disabled={bridging}>
                      <ArrowRight size={15}/>{bridging ? 'Initiating bridge...' : `Bridge ${amount} ${fromToken}`}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Check size={20} className="text-green-400"/>
                <h3 className="font-semibold text-white">Bridge initiated</h3>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-zinc-400 font-mono text-xs">Transfer ID: {bridgeResult.transfer?.id}</p>
                {bridgeResult.instructions?.map((step: string, i: number) => (
                  <p key={i} className="text-zinc-300">{step}</p>
                ))}
              </div>
              <a href="https://wormholescan.io" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <ExternalLink size={11}/> Track on Wormhole Scan
              </a>
              <button className="btn-ghost w-full text-sm" onClick={() => { setBridgeResult(null); setQuote(null) }}>New transfer</button>
            </div>
          )}
        </div>
      ) : (
        /* History */
        <div className="max-w-xl space-y-3">
          {history.length === 0 ? (
            <div className="card p-10 text-center text-zinc-500">No bridge transfers yet</div>
          ) : (
            history.map((t: any) => {
              const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.pending_source
              const Icon = s.icon
              return (
                <div key={t.id} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={s.color}/>
                      <span className={cn('text-xs font-medium', s.color)}>{s.label}</span>
                    </div>
                    <span className="text-xs text-zinc-600">{timeAgo(t.initiatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white font-semibold">{t.amount} {t.fromToken}</span>
                    <span className="text-zinc-500 capitalize">{t.fromChain}</span>
                    <ArrowRight size={13} className="text-zinc-600"/>
                    <span className="text-white font-semibold">{t.toToken}</span>
                    <span className="text-zinc-500 capitalize">{t.toChain}</span>
                  </div>
                  {t.sourceTxHash && (
                    <a href={`https://wormholescan.io/#/tx/${t.sourceTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 mt-1.5 transition-colors">
                      <ExternalLink size={9}/> View on Wormhole Scan
                    </a>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
