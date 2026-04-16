import { formatUsd } from '@/lib/utils'

interface StatProps { label: string; value: string; sub?: string }

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className="card p-5">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

interface StatsBarProps {
  totalUsd: number
  pocketCount: number
  walletCount: number
}

export function StatsBar({ totalUsd, pocketCount, walletCount }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <Stat label="Total value" value={formatUsd(totalUsd)} sub="across all pockets" />
      <Stat label="Pockets" value={String(pocketCount)} sub={pocketCount === 1 ? 'pocket' : 'pockets'} />
      <Stat label="Wallets" value={String(walletCount)} sub="connected" />
    </div>
  )
}
