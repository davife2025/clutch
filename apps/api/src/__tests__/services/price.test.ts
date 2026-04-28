import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PriceService } from '../../services/price.service.js'

describe('PriceService', () => {
  let service: PriceService

  beforeEach(() => {
    service = new PriceService()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns null for unknown token', async () => {
    const price = await service.getUsdPrice('UNKNOWN_TOKEN_XYZ')
    expect(price).toBeNull()
  })

  it('returns cached price on second call', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ethereum: { usd: 2500 } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const first  = await service.getUsdPrice('ETH')
    const second = await service.getUsdPrice('ETH')

    expect(first).toBe(2500)
    expect(second).toBe(2500)
    expect(mockFetch).toHaveBeenCalledTimes(1)  // cache hit on second call
  })

  it('returns null when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')))
    const price = await service.getUsdPrice('ETH')
    expect(price).toBeNull()
  })

  it('getBatchPrices returns map of prices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ethereum: { usd: 2500 },
        'usd-coin': { usd: 1 },
      }),
    }))

    const prices = await service.getBatchPrices(['ETH', 'USDC'])
    expect(prices['ETH']).toBe(2500)
    expect(prices['USDC']).toBe(1)
  })

  it('getBatchPrices returns empty object for unknown tokens', async () => {
    const prices = await service.getBatchPrices(['UNKNOWN1', 'UNKNOWN2'])
    expect(prices).toEqual({})
  })
})
