'use client'
import { Star, Trash2, Copy, ExternalLink } from 'lucide-react'
import { truncateAddress, chainLabel, chainColor, formatUsd } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface WalletCardProps {
  wallet: any
  onDelete?: () => void
  onSetDefault?: () => void
}

export function WalletCard({ wallet, onDelete, onSetDefault }: WalletCardProps) {
  const totalUsd = wallet.balances?.reduce((sum: number, b: any) => sum + parseFloat(b.usdValue ?? '0'), 0) ?? 0

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address)
  }

  return (
    <div className={cn('card p-5 hover:border-zinc-700 transition-colors', wallet.isDefault && 'border-green-800')}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('badge', chainColor(wallet.chain))}>{chainLabel(wallet.chain)}</span>
            <span className="badge bg-zinc-800 text-zinc-400">{wallet.type}</span>
            {wallet.isDefault && <span className="badge bg-green-900 text-green-300">default</span>}
          </div>
          {wallet.label && <p className="text-sm font-medium text-white">{wallet.label}</p>}
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-zinc-500 font-mono">{truncateAddress(wallet.address)}</span>
            <button onClick={copyAddress} className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5">
              <Copy size={11} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {!wallet.isDefault && (
            <button onClick={onSetDefault} title="Set as default"
              className="text-zinc-600 hover:text-yellow-400 transition-colors p-1.5">
              <Star size={14} />
            </button>
          )}
          <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors p-1.5">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Balances */}
      {wallet.balances && wallet.balances.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="space-y-1.5">
            {wallet.balances.slice(0, 4).map((bal: any) => (
              <div key={bal.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">{bal.token}</span>
                <div className="text-right">
                  <span className="text-white font-medium text-xs">
                    {(Number(bal.amount) / 10 ** bal.decimals).toFixed(4)}
                  </span>
                  {bal.usdValue && (
                    <span className="text-zinc-500 text-xs ml-2">{formatUsd(parseFloat(bal.usdValue))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800/50 flex justify-between text-xs">
            <span className="text-zinc-500">Total</span>
            <span className="text-white font-semibold">{formatUsd(totalUsd)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
