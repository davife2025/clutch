export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
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

export function timeAgo(date: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatTokenAmount(amount: string, decimals: number): string {
  const val = Number(BigInt(amount)) / 10 ** decimals
  return val < 0.001 ? val.toExponential(2) : val.toLocaleString('en-US', { maximumFractionDigits: 6 })
}
