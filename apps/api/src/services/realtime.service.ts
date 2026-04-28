/**
 * Real-time WebSocket server for Clutch.
 *
 * Clients connect authenticated, subscribe to a pocketId,
 * and receive live updates:
 *   - balance_update    — fresh on-chain balances
 *   - price_update      — SOL + SPL token prices
 *   - tx_confirmed      — transaction status changed
 *   - alert_triggered   — price alert hit
 *   - fee_update        — Solana network fee change
 */

import { verify } from 'hono/jwt'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { balanceService } from '../services/balance.service.js'
import { priceService }   from '../services/price.service.js'
import { estimateSolanaFee, checkAlertTriggered, type PriceAlert } from '@clutch/defi'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WsEventType =
  | 'balance_update'
  | 'price_update'
  | 'tx_confirmed'
  | 'alert_triggered'
  | 'fee_update'
  | 'subscribed'
  | 'error'

export interface WsEvent<T = unknown> {
  type:    WsEventType
  payload: T
  ts:      number
}

export interface WsClient {
  id:        string
  userId:    string
  pocketIds: Set<string>
  ws:        WebSocket
}

// ── Client registry ───────────────────────────────────────────────────────────

export class WsRegistry {
  private clients = new Map<string, WsClient>()

  add(client: WsClient) {
    this.clients.set(client.id, client)
  }

  remove(clientId: string) {
    this.clients.delete(clientId)
  }

  /** All clients subscribed to a pocketId */
  byPocket(pocketId: string): WsClient[] {
    return [...this.clients.values()].filter((c) => c.pocketIds.has(pocketId))
  }

  /** All clients for a userId */
  byUser(userId: string): WsClient[] {
    return [...this.clients.values()].filter((c) => c.userId === userId)
  }

  count(): number {
    return this.clients.size
  }

  broadcast<T>(pocketId: string, event: WsEvent<T>) {
    const msg = JSON.stringify(event)
    for (const client of this.byPocket(pocketId)) {
      try {
        client.ws.send(msg)
      } catch {
        this.remove(client.id)
      }
    }
  }

  send<T>(clientId: string, event: WsEvent<T>) {
    const client = this.clients.get(clientId)
    if (!client) return
    try {
      client.ws.send(JSON.stringify(event))
    } catch {
      this.remove(clientId)
    }
  }
}

export const wsRegistry = new WsRegistry()

// ── Event builders ────────────────────────────────────────────────────────────

export function makeEvent<T>(type: WsEventType, payload: T): WsEvent<T> {
  return { type, payload, ts: Date.now() }
}

// ── Poller: balance sync every 30 seconds ────────────────────────────────────

const BALANCE_INTERVAL_MS = 30_000
const PRICE_INTERVAL_MS   = 15_000
const FEE_INTERVAL_MS     = 20_000

const trackedPockets = new Set<string>()
const intervalHandles: NodeJS.Timer[] = []

/**
 * Start polling for a pocket — only if not already tracked.
 */
export async function trackPocket(pocketId: string) {
  if (trackedPockets.has(pocketId)) return
  trackedPockets.add(pocketId)
}

export async function untrackPocket(pocketId: string) {
  trackedPockets.delete(pocketId)
}

/**
 * Global polling loops — started once at server boot.
 */
export function startPollers() {
  // Balance poll
  const balanceHandle = setInterval(async () => {
    for (const pocketId of trackedPockets) {
      if (wsRegistry.byPocket(pocketId).length === 0) {
        untrackPocket(pocketId)
        continue
      }
      try {
        await balanceService.syncPocketBalances(pocketId)
        const totalUsd = await balanceService.getPocketTotalUsd(pocketId)
        wsRegistry.broadcast(pocketId, makeEvent('balance_update', { pocketId, totalUsd }))
      } catch (err) {
        console.error('[ws-poller] balance sync failed', pocketId, err)
      }
    }
  }, BALANCE_INTERVAL_MS)

  // Price poll — broadcast to all active pockets
  const priceHandle = setInterval(async () => {
    if (trackedPockets.size === 0) return
    try {
      const prices = await priceService.getBatchPrices(['SOL', 'USDC', 'BONK', 'JUP', 'RAY', 'WIF'])
      for (const pocketId of trackedPockets) {
        wsRegistry.broadcast(pocketId, makeEvent('price_update', { prices }))
      }
    } catch {}
  }, PRICE_INTERVAL_MS)

  // Fee poll
  const feeHandle = setInterval(async () => {
    if (trackedPockets.size === 0) return
    try {
      const solPrice = await priceService.getUsdPrice('SOL')
      const fee = await estimateSolanaFee(solPrice ?? undefined)
      for (const pocketId of trackedPockets) {
        wsRegistry.broadcast(pocketId, makeEvent('fee_update', { fee }))
      }
    } catch {}
  }, FEE_INTERVAL_MS)

  intervalHandles.push(balanceHandle, priceHandle, feeHandle)
  console.log('🔌 WebSocket pollers started')
}

export function stopPollers() {
  for (const h of intervalHandles) clearInterval(h)
}
