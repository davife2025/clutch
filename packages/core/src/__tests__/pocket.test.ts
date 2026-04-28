import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPocket, addWallet, removeWallet,
  setDefaultWallet, depositToNative, withdrawFromNative, buildSummary,
} from '../pocket.js'
import type { Pocket, Wallet } from '../types.js'

const mockWallet = (overrides: Partial<Wallet> = {}): Omit<Wallet, 'id' | 'pocketId' | 'addedAt'> => ({
  type: 'hot',
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  chain: 'ethereum',
  isDefault: false,
  ...overrides,
})

describe('createPocket', () => {
  it('creates a pocket with default values', () => {
    const p = createPocket('user-1')
    expect(p.ownerId).toBe('user-1')
    expect(p.name).toBe('My Pocket')
    expect(p.wallets).toHaveLength(0)
    expect(p.nativeBalance).toBe(BigInt(0))
  })

  it('uses a custom name', () => {
    const p = createPocket('user-1', 'DeFi Pocket')
    expect(p.name).toBe('DeFi Pocket')
  })
})

describe('addWallet', () => {
  let pocket: Pocket

  beforeEach(() => {
    pocket = { id: 'p-1', ...createPocket('user-1') }
  })

  it('adds a wallet and generates an id', () => {
    const updated = addWallet(pocket, mockWallet())
    expect(updated.wallets).toHaveLength(1)
    expect(updated.wallets[0].id).toBeDefined()
    expect(updated.wallets[0].pocketId).toBe('p-1')
  })

  it('sets addedAt timestamp', () => {
    const before = new Date()
    const updated = addWallet(pocket, mockWallet())
    expect(updated.wallets[0].addedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('updates updatedAt', () => {
    const before = pocket.updatedAt.getTime()
    const updated = addWallet(pocket, mockWallet())
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('preserves existing wallets', () => {
    const first  = addWallet(pocket, mockWallet({ label: 'first' }))
    const second = addWallet(first, mockWallet({ label: 'second' }))
    expect(second.wallets).toHaveLength(2)
  })
})

describe('removeWallet', () => {
  it('removes a wallet by id', () => {
    let pocket: Pocket = { id: 'p-1', ...createPocket('user-1') }
    pocket = addWallet(pocket, mockWallet())
    const walletId = pocket.wallets[0].id
    const updated  = removeWallet(pocket, walletId)
    expect(updated.wallets).toHaveLength(0)
  })

  it('is a no-op for unknown id', () => {
    let pocket: Pocket = { id: 'p-1', ...createPocket('user-1') }
    pocket = addWallet(pocket, mockWallet())
    const updated = removeWallet(pocket, 'nonexistent')
    expect(updated.wallets).toHaveLength(1)
  })
})

describe('setDefaultWallet', () => {
  it('marks a wallet as default and clears others', () => {
    let pocket: Pocket = { id: 'p-1', ...createPocket('user-1') }
    pocket = addWallet(pocket, mockWallet({ label: 'a' }))
    pocket = addWallet(pocket, mockWallet({ label: 'b' }))
    const [a, b] = pocket.wallets
    const updated = setDefaultWallet(pocket, b.id)
    expect(updated.wallets.find((w) => w.id === a.id)!.isDefault).toBe(false)
    expect(updated.wallets.find((w) => w.id === b.id)!.isDefault).toBe(true)
  })
})

describe('native balance', () => {
  let pocket: Pocket

  beforeEach(() => {
    pocket = { id: 'p-1', ...createPocket('user-1') }
  })

  it('deposits correctly', () => {
    const updated = depositToNative(pocket, BigInt(1e18))
    expect(updated.nativeBalance).toBe(BigInt(1e18))
  })

  it('withdraws correctly', () => {
    const funded   = depositToNative(pocket, BigInt(2e18))
    const updated  = withdrawFromNative(funded, BigInt(1e18))
    expect(updated.nativeBalance).toBe(BigInt(1e18))
  })

  it('throws on insufficient balance', () => {
    expect(() => withdrawFromNative(pocket, BigInt(1))).toThrow('Insufficient native balance')
  })

  it('allows withdrawing entire balance', () => {
    const funded  = depositToNative(pocket, BigInt(1e18))
    const updated = withdrawFromNative(funded, BigInt(1e18))
    expect(updated.nativeBalance).toBe(BigInt(0))
  })
})

describe('buildSummary', () => {
  it('sums up USD values', () => {
    const pocket: Pocket = { id: 'p-1', ...createPocket('user-1') }
    const balances = [
      { walletId: 'w-1', chain: 'ethereum' as const, token: 'ETH',  amount: BigInt(1e18), decimals: 18, usdValue: 2000, fetchedAt: new Date() },
      { walletId: 'w-1', chain: 'ethereum' as const, token: 'USDC', amount: BigInt(500e6), decimals: 6,  usdValue: 500,  fetchedAt: new Date() },
    ]
    const summary = buildSummary(pocket, balances)
    expect(summary.totalUsdValue).toBe(2500)
  })
})
