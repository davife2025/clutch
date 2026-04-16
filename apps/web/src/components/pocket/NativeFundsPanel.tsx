'use client'
import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NativeFundsPanelProps {
  pocketId: string
  nativeBalance: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NativeFundsPanel({ pocketId, nativeBalance, open, onClose, onSuccess }: NativeFundsPanelProps) {
  const [tab, setTab]           = useState<'deposit'|'withdraw'>('deposit')
  const [amount, setAmount]     = useState('')
  const [toAddress, setToAddress] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const balanceEth = (Number(nativeBalance) / 1e18).toFixed(6)

  async function handleSubmit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount'); return
    }
    if (tab === 'withdraw' && !toAddress.trim()) {
      setError('Enter a destination address'); return
    }
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (tab === 'deposit') {
        await api.deposit(pocketId, amount)
        setSuccess(`Deposited ${amount} ETH to your pocket`)
      } else {
        await api.withdraw(pocketId, amount, toAddress)
        setSuccess(`Withdrawn ${amount} ETH to ${toAddress.slice(0,8)}...`)
      }
      setAmount(''); setToAddress('')
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Native funds">
      <div>
        {/* Balance */}
        <div className="bg-zinc-800 rounded-xl p-4 mb-5 text-center">
          <p className="text-xs text-zinc-500 mb-1">Native balance</p>
          <p className="text-2xl font-bold text-white">{balanceEth} ETH</p>
          <p className="text-xs text-zinc-500 mt-1">Held directly in your Clutch pocket</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-zinc-900 p-1 rounded-xl">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors capitalize', tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}>
              {t === 'deposit' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {error && <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl">{error}</div>}
          {success && <div className="bg-green-950 border border-green-800 text-green-300 text-sm px-4 py-3 rounded-xl">{success}</div>}

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Amount (ETH)</label>
            <input className="input" type="number" step="0.0001" min="0" placeholder="0.0"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          {tab === 'withdraw' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Destination address</label>
              <input className="input font-mono text-sm" placeholder="0x..."
                value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
            </div>
          )}

          {tab === 'deposit' && (
            <div className="bg-zinc-800/50 rounded-xl p-3 text-xs text-zinc-500 space-y-1">
              <p>• Funds are held in your Clutch pocket</p>
              <p>• Use the AI agent to pay from this balance automatically</p>
              <p>• Withdraw anytime to any EVM address</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Processing...' : tab === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
