'use client'
import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { RefreshCw, Send, ExternalLink } from 'lucide-react'
import { formatUsd, truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

function NftCard({ nft, onSelect }: { nft: any; onSelect: () => void }) {
  const image = nft.imageUrl || nft.metadata?.image
  return (
    <div
      className="card overflow-hidden cursor-pointer hover:border-zinc-700 transition-all group"
      onClick={onSelect}
    >
      <div className="aspect-square bg-zinc-800 overflow-hidden relative">
        {image ? (
          <img src={image} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-4xl">🖼️</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-white truncate">{nft.name}</p>
        {nft.collectionName && <p className="text-xs text-zinc-500 truncate mt-0.5">{nft.collectionName}</p>}
        {nft.floorPriceSol && (
          <p className="text-xs text-green-400 mt-1">{parseFloat(nft.floorPriceSol).toFixed(3)} SOL floor</p>
        )}
      </div>
    </div>
  )
}

function NftDetail({ nft, onClose }: { nft: any; onClose: () => void }) {
  const [transferTo, setTransferTo] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [txResult, setTxResult]         = useState<string | null>(null)
  const image = nft.imageUrl || nft.metadata?.image
  const attrs = nft.metadata?.attributes ?? []

  async function handleTransfer() {
    if (!transferTo.trim()) return
    setTransferring(true)
    try {
      const r = await authFetch('/nfts/transfer', {
        method: 'POST',
        body: JSON.stringify({ mint: nft.mint, fromAddress: nft.walletAddress, toAddress: transferTo }),
      })
      if (r.error) { alert(r.error.message); return }
      setTxResult(r.data?.transaction ?? 'Transaction built — sign with your wallet')
    } finally { setTransferring(false) }
  }

  return (
    <Modal open onClose={onClose} title={nft.name} className="max-w-lg">
      <div className="space-y-4">
        {image && (
          <div className="aspect-square rounded-xl overflow-hidden bg-zinc-800">
            <img src={image} alt={nft.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-1">
          {nft.collectionName && <p className="text-xs text-zinc-500">{nft.collectionName}</p>}
          <p className="text-sm text-zinc-400">{nft.metadata?.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-500 mb-0.5">Mint</p>
            <p className="text-zinc-300 font-mono">{truncateAddress(nft.mint, 6)}</p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-500 mb-0.5">Owner</p>
            <p className="text-zinc-300 font-mono">{truncateAddress(nft.walletAddress ?? '', 6)}</p>
          </div>
          {nft.floorPriceSol && (
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-zinc-500 mb-0.5">Floor price</p>
              <p className="text-green-400 font-semibold">{parseFloat(nft.floorPriceSol).toFixed(3)} SOL</p>
            </div>
          )}
        </div>

        {attrs.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Attributes</p>
            <div className="grid grid-cols-3 gap-2">
              {attrs.map((a: any, i: number) => (
                <div key={i} className="bg-zinc-800 rounded-lg p-2 text-center">
                  <p className="text-xs text-zinc-500 truncate">{a.trait_type}</p>
                  <p className="text-xs text-zinc-200 font-medium truncate">{a.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {txResult ? (
          <div className="bg-green-950 border border-green-800 text-green-300 text-xs p-3 rounded-xl break-all">
            <p className="font-semibold mb-1">Transaction built:</p>
            <p className="font-mono">{txResult.slice(0, 60)}...</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Transfer NFT</p>
            <div className="flex gap-2">
              <input className="input text-sm flex-1 font-mono py-2" placeholder="Recipient Solana address"
                value={transferTo} onChange={e => setTransferTo(e.target.value)} />
              <button className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm shrink-0"
                onClick={handleTransfer} disabled={transferring || !transferTo.trim()}>
                <Send size={13}/>{transferring ? '...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        <a href={`https://solscan.io/token/${nft.mint}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ExternalLink size={11}/> View on Solscan
        </a>
      </div>
    </Modal>
  )
}

export default function NftsPage() {
  const [pockets, setPockets]   = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [nfts, setNfts]         = useState<any[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [activeNft, setActiveNft] = useState<any>(null)
  const [filterCol, setFilterCol] = useState<string>('all')

  useEffect(() => {
    authFetch('/pockets').then(r => {
      const ps = r.data?.pockets ?? []
      setPockets(ps)
      if (ps.length > 0) setSelected(ps[0].id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await authFetch(`/nfts/${selected}`)
      setNfts(r.data?.nfts ?? [])
      setTotalValue(r.data?.estimatedValueSOL ?? 0)
    } finally { setLoading(false) }
  }, [selected])

  useEffect(() => { if (selected) load() }, [selected, load])

  async function sync() {
    setSyncing(true)
    await authFetch(`/nfts/${selected}/sync`, { method: 'POST' })
    setTimeout(() => { load(); setSyncing(false) }, 4000)
  }

  // Unique collections for filter
  const collections = ['all', ...new Set(nfts.map(n => n.collectionName).filter(Boolean))]
  const filtered = filterCol === 'all' ? nfts : nfts.filter(n => n.collectionName === filterCol)

  return (
    <div>
      <TopBar title="NFTs" actions={
        <button className="btn-ghost flex items-center gap-1.5 text-sm py-1.5 px-3" onClick={sync} disabled={syncing}>
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''}/>{syncing ? 'Syncing...' : 'Sync'}
        </button>
      } />

      {/* Pocket selector */}
      {pockets.length > 1 && (
        <div className="flex gap-2 mb-4">
          {pockets.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', selected === p.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      {nfts.length > 0 && (
        <div className="flex items-center gap-6 mb-6 card p-4">
          <div><p className="text-2xl font-bold text-white">{nfts.length}</p><p className="text-xs text-zinc-500">Items</p></div>
          <div><p className="text-2xl font-bold text-white">{totalValue.toFixed(2)}</p><p className="text-xs text-zinc-500">Est. SOL</p></div>
          <div><p className="text-2xl font-bold text-white">{collections.length - 1}</p><p className="text-xs text-zinc-500">Collections</p></div>
        </div>
      )}

      {/* Collection filter */}
      {collections.length > 2 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {collections.map(col => (
            <button key={col} onClick={() => setFilterCol(col)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap', filterCol === col ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-900')}>
              {col === 'all' ? 'All' : col}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🖼️"
          title="No NFTs yet"
          description="Add a Solana wallet and sync to see your NFT collection."
          action={<button className="btn-ghost text-sm" onClick={sync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync now'}</button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(nft => (
            <NftCard key={nft.mint + nft.walletId} nft={nft} onSelect={() => setActiveNft(nft)} />
          ))}
        </div>
      )}

      {activeNft && <NftDetail nft={activeNft} onClose={() => setActiveNft(null)} />}
    </div>
  )
}
