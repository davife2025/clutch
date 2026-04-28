import { formatUsd, timeAgo, chainLabel, truncateAddress } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, Zap, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TX_ICONS: Record<string, any> = {
  deposit:  { icon: ArrowDownLeft,  color: 'text-green-400', bg: 'bg-green-900/30' },
  withdraw: { icon: ArrowUpRight,   color: 'text-red-400',   bg: 'bg-red-900/30'   },
  payment:  { icon: Zap,            color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  transfer: { icon: ArrowLeftRight, color: 'text-blue-400',  bg: 'bg-blue-900/30'  },
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-900 text-green-300',
  pending:   'bg-yellow-900 text-yellow-300',
  failed:    'bg-red-900 text-red-300',
}

export function TransactionList({ transactions }: { transactions: any[] }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-zinc-400">No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="card divide-y divide-zinc-800">
      {transactions.map((tx) => {
        const { icon: Icon, color, bg } = TX_ICONS[tx.type] ?? TX_ICONS.transfer
        const amount = (Number(tx.amount) / 1e9).toFixed(6)
        return (
          <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-zinc-800/30 transition-colors">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
              <Icon size={16} className={color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white capitalize">{tx.type}</span>
                <span className={cn('badge', STATUS_COLORS[tx.status])}>{tx.status}</span>
                <span className="badge bg-zinc-800 text-zinc-400 text-xs">{chainLabel(tx.chain)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {truncateAddress(tx.fromAddress)} → {truncateAddress(tx.toAddress)}
                {tx.memo && <span className="ml-2 italic">"{tx.memo}"</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-white">{amount} {tx.token}</p>
              <p className="text-xs text-zinc-500">{timeAgo(tx.createdAt)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
