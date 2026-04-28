'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { Search, Code, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const CATEGORY_COLORS: Record<string, string> = {
  defi:       'bg-blue-900 text-blue-300',
  nft:        'bg-purple-900 text-purple-300',
  staking:    'bg-green-900 text-green-300',
  governance: 'bg-yellow-900 text-yellow-300',
  token:      'bg-teal-900 text-teal-300',
  infra:      'bg-zinc-800 text-zinc-400',
}

function IdlInstructionCard({ ix }: { ix: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
        onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Code size={13} className="text-green-400 shrink-0"/>
          <span className="text-sm font-mono font-semibold text-white">{ix.name}</span>
          {ix.docs && <span className="text-xs text-zinc-500 truncate">{ix.docs}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge bg-zinc-800 text-zinc-500 text-xs">{ix.argCount} args</span>
          <span className="badge bg-zinc-800 text-zinc-500 text-xs">{ix.accounts} accounts</span>
          {open ? <ChevronDown size={14} className="text-zinc-500"/> : <ChevronRight size={14} className="text-zinc-500"/>}
        </div>
      </button>
      {open && ix._full && (
        <div className="px-4 pb-3 space-y-3 bg-zinc-900/50">
          {ix._full.args.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Arguments</p>
              <div className="space-y-1">
                {ix._full.args.map((arg: any) => (
                  <div key={arg.name} className="flex items-center gap-2 text-xs">
                    <span className="text-white font-mono">{arg.name}</span>
                    <span className="text-zinc-500">:</span>
                    <span className="text-blue-400 font-mono">{typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ix._full.accounts.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Accounts</p>
              <div className="space-y-1">
                {ix._full.accounts.map((acc: any) => (
                  <div key={acc.name} className="flex items-center gap-2 text-xs">
                    <span className="text-white font-mono">{acc.name}</span>
                    <div className="flex gap-1">
                      {acc.isMut    && <span className="badge bg-amber-900 text-amber-300">mut</span>}
                      {acc.isSigner && <span className="badge bg-purple-900 text-purple-300">signer</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProgramsPage() {
  const [programs, setPrograms]     = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filterCat, setFilterCat]   = useState('all')
  const [loading, setLoading]       = useState(true)
  const [searchQ, setSearchQ]       = useState('')
  const [searching, setSearching]   = useState(false)
  const [searchResults, setResults] = useState<any[]>([])

  // IDL explorer
  const [programId, setProgramId]   = useState('')
  const [idlData, setIdlData]       = useState<any>(null)
  const [loadingIdl, setLoadingIdl] = useState(false)
  const [idlError, setIdlError]     = useState('')

  // Account reader
  const [accountAddr, setAccountAddr] = useState('')
  const [accountData, setAccountData] = useState<any>(null)
  const [loadingAccount, setLoadingAccount] = useState(false)

  const [activeTab, setActiveTab] = useState<'programs'|'idl'|'account'>('programs')

  useEffect(() => {
    Promise.all([
      authFetch('/programs').then(r => setPrograms(r.data?.programs ?? [])),
      authFetch('/programs/categories').then(r => setCategories(r.data?.categories ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  async function search() {
    if (!searchQ.trim()) return
    setSearching(true)
    try {
      const r = await authFetch(`/programs/search?q=${encodeURIComponent(searchQ)}`)
      setResults(r.data?.programs ?? [])
    } finally { setSearching(false) }
  }

  async function loadIdl() {
    if (!programId.trim()) return
    setLoadingIdl(true); setIdlData(null); setIdlError('')
    try {
      const r = await authFetch(`/programs/idl/${programId.trim()}`)
      if (r.error) { setIdlError(r.error.message); return }
      setIdlData(r.data)
    } finally { setLoadingIdl(false) }
  }

  async function readAccount() {
    if (!accountAddr.trim()) return
    setLoadingAccount(true); setAccountData(null)
    try {
      const r = await authFetch(`/programs/account/${accountAddr.trim()}`)
      if (r.error) { alert(r.error.message); return }
      setAccountData(r.data)
    } finally { setLoadingAccount(false) }
  }

  const displayed = (searchResults.length > 0 ? searchResults : programs)
    .filter(p => filterCat === 'all' || p.category === filterCat)

  return (
    <div>
      <TopBar title="On-chain programs" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-xl w-fit">
        {(['programs','idl','account'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
            {t === 'programs' ? 'Known programs' : t === 'idl' ? 'IDL explorer' : 'Account reader'}
          </button>
        ))}
      </div>

      {/* Known programs */}
      {activeTab === 'programs' && (
        loading ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8"/></div> : (
          <div className="space-y-5">
            {/* Search + filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                <input className="input pl-9 text-sm" placeholder="Search programs..."
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') search() }} />
              </div>
              <button className="btn-ghost text-sm px-4" onClick={search} disabled={searching}>
                {searching ? '...' : 'Search'}
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', ...categories].map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                    filterCat === cat ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-900')}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Program grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map(p => (
                <div key={p.programId} className="card p-4 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                    <span className={cn('badge', CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.infra)}>{p.category}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{p.description}</p>
                  <p className="text-xs font-mono text-zinc-600 mb-3 truncate">{p.programId}</p>
                  <div className="flex gap-2">
                    <button className="btn-ghost text-xs py-1.5 px-3"
                      onClick={() => { setProgramId(p.programId); setActiveTab('idl') }}>
                      View IDL
                    </button>
                    {p.docsUrl && (
                      <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                        Docs <ExternalLink size={10}/>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* IDL explorer */}
      {activeTab === 'idl' && (
        <div className="max-w-2xl space-y-5">
          <div className="flex gap-3">
            <input className="input font-mono text-sm flex-1" placeholder="Program ID (e.g. dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH)"
              value={programId} onChange={e => setProgramId(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadIdl() }} />
            <button className="btn-primary px-5 text-sm" onClick={loadIdl} disabled={loadingIdl || !programId.trim()}>
              {loadingIdl ? <Spinner className="w-4 h-4"/> : 'Load IDL'}
            </button>
          </div>

          {idlError && <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">{idlError}</div>}

          {idlData && (
            <div className="space-y-5">
              {/* Program header */}
              <div className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">{idlData.idl.name}</h2>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">{idlData.idl.programId ?? programId}</p>
                  </div>
                  {idlData.known && (
                    <span className={cn('badge', CATEGORY_COLORS[idlData.known.category] ?? CATEGORY_COLORS.infra)}>
                      {idlData.known.category}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="bg-zinc-800 rounded-xl p-3">
                    <p className="text-xl font-bold text-white">{idlData.instructions.length}</p>
                    <p className="text-xs text-zinc-500">Instructions</p>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-3">
                    <p className="text-xl font-bold text-white">{idlData.accountTypes.length}</p>
                    <p className="text-xs text-zinc-500">Account types</p>
                  </div>
                  <div className="bg-zinc-800 rounded-xl p-3">
                    <p className="text-xl font-bold text-white">{idlData.idl.version}</p>
                    <p className="text-xs text-zinc-500">IDL version</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Instructions</h3>
                <div className="space-y-2">
                  {idlData.instructions.map((ix: any, i: number) => (
                    <IdlInstructionCard key={i} ix={{
                      ...ix,
                      _full: idlData.idl.instructions[i],
                    }}/>
                  ))}
                </div>
              </div>

              {/* Account types */}
              {idlData.accountTypes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Account types</h3>
                  <div className="space-y-2">
                    {idlData.accountTypes.map((acc: any) => (
                      <div key={acc.name} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                        <span className="text-sm font-mono text-white">{acc.name}</span>
                        <span className="badge bg-zinc-800 text-zinc-400">{acc.fieldCount} fields</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Account reader */}
      {activeTab === 'account' && (
        <div className="max-w-2xl space-y-5">
          <div className="flex gap-3">
            <input className="input font-mono text-sm flex-1" placeholder="Account address"
              value={accountAddr} onChange={e => setAccountAddr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') readAccount() }} />
            <button className="btn-primary px-5 text-sm" onClick={readAccount} disabled={loadingAccount || !accountAddr.trim()}>
              {loadingAccount ? <Spinner className="w-4 h-4"/> : 'Read'}
            </button>
          </div>

          {accountData && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Account data</h3>
                <a href={`https://solscan.io/account/${accountData.account.address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <ExternalLink size={14}/>
                </a>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Address</span><span className="text-zinc-300 font-mono text-xs">{accountData.account.address}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Lamports</span><span className="text-white">{(accountData.account.lamports / 1e9).toFixed(6)} SOL</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Owner</span>
                  <span className="text-right">
                    <span className="text-zinc-300 font-mono text-xs block">{accountData.account.owner.slice(0,16)}...</span>
                    {accountData.owner?.name && <span className="text-zinc-500 text-xs">{accountData.owner.name}</span>}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Raw data (hex)</p>
                <pre className="bg-zinc-900 rounded-xl p-3 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {accountData.account.data.slice(0, 256)}{accountData.account.data.length > 256 ? '...' : ''}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
