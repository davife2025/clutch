'use client'
import Link from 'next/link'
import { Wallet, ChevronRight, Trash2 } from 'lucide-react'
import { formatUsd } from '@/lib/utils'

interface PocketCardProps {
  pocket: any
  totalUsd?: number
  onDelete?: (id: string) => void
}

export function PocketCard({ pocket, totalUsd = 0, onDelete }: PocketCardProps) {
  return (
    <div className="card p-5 hover:border-zinc-700 transition-colors group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <span className="text-xl">🫙</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">{pocket.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {pocket.wallets?.length ?? 0} wallet{pocket.wallets?.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDelete?.(pocket.id)}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-white">{formatUsd(totalUsd)}</p>
        <p className="text-xs text-zinc-500 mt-0.5">Total value</p>
      </div>

      <Link href={`/dashboard/pocket/${pocket.id}`}
        className="flex items-center justify-between text-sm text-zinc-400 hover:text-white transition-colors">
        <span>View pocket</span>
        <ChevronRight size={15} />
      </Link>
    </div>
  )
}
