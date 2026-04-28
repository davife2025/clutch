import { describe, it, expect } from 'vitest'
import {
  weiToEth, ethToWei, truncateAddress,
  isValidEthAddress, isValidSolanaAddress, generateId,
} from '../utils.js'

describe('weiToEth', () => {
  it('converts 1 ETH correctly', () => {
    expect(weiToEth(BigInt('1000000000000000000'))).toBe('1')
  })

  it('converts fractional ETH', () => {
    expect(weiToEth(BigInt('500000000000000000'))).toBe('0.5')
  })

  it('handles zero', () => {
    expect(weiToEth(BigInt(0))).toBe('0')
  })

  it('strips trailing zeros from fraction', () => {
    const result = weiToEth(BigInt('100000000000000000'))
    expect(result).toBe('0.1')
  })
})

describe('ethToWei', () => {
  it('converts 1 ETH to wei', () => {
    expect(ethToWei('1')).toBe(BigInt('1000000000000000000'))
  })

  it('converts fractional amounts', () => {
    expect(ethToWei('0.5')).toBe(BigInt('500000000000000000'))
  })

  it('handles integers without decimals', () => {
    expect(ethToWei('2')).toBe(BigInt('2000000000000000000'))
  })

  it('roundtrips with weiToEth', () => {
    const original = '0.123456'
    const wei      = ethToWei(original)
    const back     = weiToEth(wei)
    expect(back).toBe(original)
  })
})

describe('truncateAddress', () => {
  it('truncates a long ETH address', () => {
    const addr   = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    const result = truncateAddress(addr)
    expect(result).toMatch(/^0x.{4}\.\.\./)
    expect(result.endsWith(addr.slice(-4))).toBe(true)
  })

  it('uses custom char count', () => {
    const addr   = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    const result = truncateAddress(addr, 6)
    expect(result).toContain('...')
    expect(result.endsWith(addr.slice(-6))).toBe(true)
  })

  it('handles empty string', () => {
    expect(truncateAddress('')).toBe('')
  })
})

describe('isValidEthAddress', () => {
  it('accepts valid checksummed address', () => {
    expect(isValidEthAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true)
  })

  it('accepts lowercase address', () => {
    expect(isValidEthAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true)
  })

  it('rejects missing 0x prefix', () => {
    expect(isValidEthAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false)
  })

  it('rejects too-short address', () => {
    expect(isValidEthAddress('0x123')).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(isValidEthAddress('0xGGGG6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false)
  })
})

describe('isValidSolanaAddress', () => {
  it('accepts valid Solana address', () => {
    expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true)
  })

  it('rejects too-short string', () => {
    expect(isValidSolanaAddress('abc')).toBe(false)
  })

  it('rejects string with 0x prefix', () => {
    expect(isValidSolanaAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false)
  })
})

describe('generateId', () => {
  it('generates a 32-char hex string', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId))
    expect(ids.size).toBe(100)
  })
})
