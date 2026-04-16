import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatToken(amount: string, decimals: number, symbol: string): string {
  const val = Number(BigInt(amount)) / 10 ** decimals
  const formatted = val < 0.001 ? val.toExponential(2) : val.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return `${formatted} ${symbol}`
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function chainLabel(chain: string): string {
  const labels: Record<string, string> = {
    ethereum: 'Ethereum', base: 'Base', polygon: 'Polygon',
    arbitrum: 'Arbitrum', optimism: 'Optimism', solana: 'Solana',
  }
  return labels[chain] ?? chain
}

export function chainColor(chain: string): string {
  const colors: Record<string, string> = {
    ethereum: 'bg-blue-100 text-blue-800',
    base:     'bg-indigo-100 text-indigo-800',
    polygon:  'bg-purple-100 text-purple-800',
    arbitrum: 'bg-cyan-100 text-cyan-800',
    optimism: 'bg-red-100 text-red-800',
    solana:   'bg-green-100 text-green-800',
  }
  return colors[chain] ?? 'bg-gray-100 text-gray-800'
}

export function timeAgo(date: string | Date): string {
  const now = Date.now()
  const d = new Date(date).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
