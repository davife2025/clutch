'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { Search, Vote, ExternalLink, Shield, Clock, Check, X, Minus } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const STATE_STYLES: Record<string, string> = {
  Voting:    'bg-blue-900 text-blue-300',
  Succeeded: 'bg-green-900 text-green-300',
  Defeated:  'bg-red-900 text-red-300',
  Executing: 'bg-yellow-900 text-yellow-300',
  Completed: 'bg-zinc-700 text-zinc-300',
  Cancelled: 'bg-zinc-800 text-zinc-500',
  Draft:     'bg-zinc-800 text-zinc-400',
}

function ProposalCard({ proposal, realmAddress, onVote }: {
  proposal: any; realmAddress: string; onVote: (p: any) => void
}) {
  const yesVotes  = BigInt(proposal.yesVoteCount ?? '0')
  const noVotes   = BigInt(proposal.noVoteCount  ?? '0')
  const total     = yesVotes + noVotes
  const yesPct    = total > 0n ? Number((yesVotes * 100n) / total) : 0
  const isVoting  = proposal.state === 'Voting'
  const endsAt    = proposal.votingAt && proposal.maxVotingTime
    ? new Date((proposal.votingAt + proposal.maxVotingTime) * 1000)
    : null

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('badge', STATE_STYLES[proposal.state] ?? STATE_STYLES.Draft)}>{proposal.state}</span>
            {endsAt && isVoting && (
              <span className="badge bg-zinc-800 text-zinc-400 flex items-center gap-1">
                <Clock size={10}/> ends {timeAgo(endsAt)}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{proposal.name}</h3>
          {proposal.description && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{proposal.description}</p>
          )}
        </div>
        {proposal.descriptionLink && (
          <a href={proposal.descriptionLink} target="_blank" rel="noopener noreferrer"
            className="text-zinc-600 hover:text-zinc-300 shrink-0 transition-colors">
            <ExternalLink size={14}/>
          </a>
        )}
      </div>

      {/* Vote bar */}
      {total > 0n && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span className="text-green-400">{yesPct}% yes</span>
            <span className="text-red-400">{100 - yesPct}% no</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${yesPct}%` }} />
          </div>
        </div>
      )}

      {isVoting && (
        <div className="flex gap-2">
          <button onClick={() => onVote({ ...proposal, castVote: 'Yes' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-900/30 text-green-300 hover:bg-green-900/50 text-xs font-semibold transition-colors">
            <Check size={12}/> Yes
          </button>
          <button onClick={() => onVote({ ...proposal, castVote: 'No' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-900/30 text-red-300 hover:bg-red-900/50 text-xs font-semibold transition-colors">
            <X size={12}/> No
          </button>
          <button onClick={() => onVote({ ...proposal, castVote: 'Abstain' })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs font-semibold transition-colors">
            <Minus size={12}/> Abstain
          </button>
        </div>
      )}
    </div>
  )
}

export default function GovernancePage() {
  const [featured, setFeatured]       = useState<any[]>([])
  const [pockets, setPockets]         = useState<any[]>([])
  const [selectedPocket, setSelected] = useState<string>('')
  const [myDaos, setMyDaos]           = useState<any[]>([])
  const [activeRealm, setActiveRealm] = useState<any>(null)
  const [proposals, setProposals]     = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [searchQ, setSearchQ]         = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching]     = useState(false)
  const [votePending, setVotePending] = useState<any>(null)
  const [voting, setVoting]           = useState(false)

  useEffect(() => {
    Promise.all([
      authFetch('/governance/featured').then(r => setFeatured(r.data?.realms ?? [])),
      authFetch('/pockets').then(r => {
        const ps = r.data?.pockets ?? []
        setPockets(ps)
        if (ps.length > 0) setSelected(ps[0].id)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedPocket) return
    authFetch(`/governance/pocket/${selectedPocket}/power`).then(r => setMyDaos(r.data?.daos ?? []))
  }, [selectedPocket])

  const loadRealm = useCallback(async (address: string) => {
    setActiveRealm(null); setProposals([])
    const r = await authFetch(`/governance/realm/${address}`)
    setActiveRealm(r.data?.realm ?? null)
    setProposals(r.data?.activeProposals ?? [])
  }, [])

  async function search() {
    if (!searchQ.trim()) return
    setSearching(true)
    try {
      const r = await authFetch(`/governance/search?q=${encodeURIComponent(searchQ)}`)
      setSearchResults(r.data?.realms ?? [])
    } finally { setSearching(false) }
  }

  async function castVote(proposal: any, voterAddress: string) {
    setVoting(true)
    try {
      const r = await authFetch('/governance/vote', {
        method: 'POST',
        body: JSON.stringify({
          realmAddress:    proposal.realmAddress,
          proposalAddress: proposal.address,
          voterAddress,
          vote:            proposal.castVote,
        }),
      })
      if (r.error) { alert(r.error.message); return }
      alert(`Vote transaction built. Sign with your wallet:\n${r.data?.message}`)
      setVotePending(null)
    } finally { setVoting(false) }
  }

  const allSolanaWallets = pockets
    .flatMap((p: any) => (p.wallets ?? []).filter((w: any) => w.chain === 'solana'))

  return (
    <div>
      <TopBar title="Governance" />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : (
        <div className="space-y-8">

          {/* My voting power */}
          {myDaos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">My DAOs</h2>
                {pockets.length > 1 && (
                  <div className="flex gap-2">
                    {pockets.map(p => (
                      <button key={p.id} onClick={() => setSelected(p.id)}
                        className={cn('px-2 py-1 rounded-lg text-xs font-medium transition-colors', selectedPocket === p.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {myDaos.map((dao: any) => (
                  <button key={dao.realm.address}
                    onClick={() => loadRealm(dao.realm.address)}
                    className="card p-4 text-left hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      {dao.realm.iconUrl
                        ? <img src={dao.realm.iconUrl} alt={dao.realm.name} className="w-8 h-8 rounded-lg" />
                        : <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center"><Vote size={14} className="text-zinc-400"/></div>
                      }
                      <span className="font-semibold text-white text-sm">{dao.realm.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn('flex items-center gap-1', dao.canVote ? 'text-green-400' : 'text-zinc-500')}>
                        <Shield size={10}/> {dao.canVote ? 'Can vote' : 'No power'}
                      </span>
                      {dao.realm.votingProposalCount > 0 && (
                        <span className="badge bg-blue-900 text-blue-300">{dao.realm.votingProposalCount} active</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Find a DAO</h2>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                <input className="input pl-9 text-sm" placeholder="Search DAOs by name..."
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') search() }} />
              </div>
              <button className="btn-primary px-4 text-sm" onClick={search} disabled={searching}>
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {searchResults.map(r => (
                  <button key={r.address} onClick={() => loadRealm(r.address)}
                    className="card p-4 text-left hover:border-zinc-700 transition-colors">
                    <p className="font-semibold text-white text-sm">{r.name}</p>
                    {r.votingProposalCount > 0 && <p className="text-xs text-blue-400 mt-1">{r.votingProposalCount} active proposals</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active realm */}
          {activeRealm && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                {activeRealm.iconUrl && <img src={activeRealm.iconUrl} alt={activeRealm.name} className="w-10 h-10 rounded-xl"/>}
                <div>
                  <h2 className="text-lg font-bold text-white">{activeRealm.name}</h2>
                  {activeRealm.description && <p className="text-xs text-zinc-500">{activeRealm.description}</p>}
                </div>
                {activeRealm.website && (
                  <a href={activeRealm.website} target="_blank" rel="noopener noreferrer" className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors"><ExternalLink size={15}/></a>
                )}
              </div>

              {proposals.length === 0 ? (
                <div className="card p-8 text-center text-zinc-500">No active proposals</div>
              ) : (
                <div className="space-y-3">
                  {proposals.map(p => (
                    <ProposalCard key={p.address} proposal={{ ...p, realmAddress: activeRealm.address }} onVote={setVotePending} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Featured DAOs */}
          {!activeRealm && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Featured DAOs</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {featured.map(r => (
                  <button key={r.address} onClick={() => loadRealm(r.address)}
                    className="card p-4 text-center hover:border-zinc-700 transition-colors">
                    {r.iconUrl ? <img src={r.iconUrl} alt={r.name} className="w-10 h-10 rounded-xl mx-auto mb-2"/> : <div className="w-10 h-10 rounded-xl bg-zinc-800 mx-auto mb-2 flex items-center justify-center"><Vote size={16} className="text-zinc-500"/></div>}
                    <p className="text-xs font-semibold text-white">{r.name}</p>
                    {r.votingProposalCount > 0 && <p className="text-xs text-blue-400 mt-0.5">{r.votingProposalCount} active</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Vote confirmation */}
      {votePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setVotePending(null)}/>
          <div className="card relative z-10 w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Cast vote: <span className={votePending.castVote === 'Yes' ? 'text-green-400' : votePending.castVote === 'No' ? 'text-red-400' : 'text-zinc-400'}>{votePending.castVote}</span></h3>
            <p className="text-sm text-zinc-300 line-clamp-3">{votePending.name}</p>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Vote with wallet</label>
              <select className="input text-sm">
                {allSolanaWallets.map((w: any) => <option key={w.address} value={w.address}>{w.label ?? w.address.slice(0,16)}...</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setVotePending(null)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={voting}
                onClick={() => castVote(votePending, allSolanaWallets[0]?.address ?? '')}>
                {voting ? 'Building tx...' : 'Confirm vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
