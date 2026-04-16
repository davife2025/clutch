import { randomBytes } from 'crypto'

export function generateId(): string {
  return randomBytes(16).toString('hex')
}

export function weiToEth(wei: bigint, decimals = 18): string {
  const divisor = BigInt(10 ** decimals)
  const whole = wei / divisor
  const remainder = wei % divisor
  const fraction = remainder.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}

export function ethToWei(eth: string, decimals = 18): bigint {
  const [whole, fraction = ''] = eth.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isValidEthAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
