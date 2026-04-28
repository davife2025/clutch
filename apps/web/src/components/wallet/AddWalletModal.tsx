'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'

const CHAINS = ['solana', 'ethereum', 'base', 'polygon', 'arbitrum', 'optimism']
const TYPES  = ['hot', 'cold', 'hardware']

interface AddWalletModalProps {
  pocketId: string
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export function AddWalletModal({ pocketId, open, onClose, onAdded }: AddWalletModalProps) {
  const [address, setAddress] = useState('')
  const [chain, setChain]     = useState('solana')   // Solana default
  const [type, setType]       = useState('hot')
  const [label, setLabel]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!address.trim()) { setError('Address is required'); return }
    setError('')
    setLoading(true)
    try {
      await api.addWallet(pocketId, { address: address.trim(), chain, type, label: label || undefined })
      setAddress(''); setLabel('')
      onAdded(); onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const placeholder = chain === 'solana'
    ? 'Solana address (e.g. EPjFW...)'
    : '0x EVM address'

  return (
    <Modal open={open} onClose={onClose} title="Add wallet">
      <div className="space-y-4">
        {error && <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Chain</label>
            <select className="input text-sm" value={chain} onChange={(e) => setChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c} value={c}>{c === 'solana' ? '⬡ Solana (primary)' : c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Type</label>
            <select className="input text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Wallet address</label>
          <input className="input font-mono text-sm" placeholder={placeholder}
            value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Label (optional)</label>
          <input className="input text-sm" placeholder="e.g. Main SOL, DeFi wallet"
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding...' : 'Add wallet'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
