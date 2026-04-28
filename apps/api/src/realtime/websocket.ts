/**
 * WebSocket manager for real-time balance updates and alert notifications.
 * Uses Hono's built-in WebSocket upgrade support.
 *
 * Client connects to: ws://localhost:3001/ws?token=<jwt>
 * Server pushes events:
 *   { type: 'balance_update', pocketId, wallets, totalUsd }
 *   { type: 'price_alert',    alert, currentPrice }
 *   { type: 'tx_confirmed',   txId, txHash, pocketId }
 *   { type: 'ping' }
 */
import { verify } from 'hono/jwt'
import { balanceService } from '../services/balance.service.js'
import { alertsService } from '../services/defi/alerts.service.js'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export interface WSClient {
  userId:  string
  send:    (data: string) => void
  alive:   boolean
}

const clients = new Map<string, WSClient>()  // clientId → client

export function getClientCount(): number { return clients.size }

/**
 * Register a new WebSocket client.
 * Called from the Hono WS upgrade handler.
 */
export function registerClient(clientId: string, client: WSClient) {
  clients.set(clientId, client)
  console.log(`[ws] client connected: ${clientId} (user: ${client.userId}) — total: ${clients.size}`)
}

export function removeClient(clientId: string) {
  clients.delete(clientId)
  console.log(`[ws] client disconnected: ${clientId} — total: ${clients.size}`)
}

/**
 * Push a balance update to all connections for a given user.
 */
export async function pushBalanceUpdate(userId: string, pocketId: string) {
  const userClients = [...clients.values()].filter((c) => c.userId === userId && c.alive)
  if (userClients.length === 0) return

  try {
    await balanceService.syncPocketBalances(pocketId)
    const balanceData = await balanceService.getPocketTotalUsd(pocketId)

    const event = JSON.stringify({
      type:     'balance_update',
      pocketId,
      totalUsd: balanceData,
      updatedAt: new Date().toISOString(),
    })

    for (const client of userClients) {
      try { client.send(event) } catch {}
    }
  } catch (err) {
    console.error('[ws] pushBalanceUpdate error:', err)
  }
}

/**
 * Broadcast a tx confirmation to a user.
 */
export function pushTxConfirmed(userId: string, payload: { txId: string; txHash: string; pocketId: string }) {
  const userClients = [...clients.values()].filter((c) => c.userId === userId && c.alive)
  const event = JSON.stringify({ type: 'tx_confirmed', ...payload })
  for (const client of userClients) {
    try { client.send(event) } catch {}
  }
}

/**
 * Worker: check price alerts every 60s and push to relevant users.
 */
export function startAlertWorker() {
  setInterval(async () => {
    const triggered = await alertsService.checkAlerts()
    for (const { alert, currentPrice } of triggered) {
      const event = JSON.stringify({ type: 'price_alert', alert, currentPrice })
      const userClients = [...clients.values()].filter((c) => c.userId === alert.userId && c.alive)
      for (const client of userClients) {
        try { client.send(event) } catch {}
      }
    }
    if (triggered.length > 0) {
      console.log(`[ws] fired ${triggered.length} price alert(s)`)
    }
  }, 60_000)
}

/**
 * Worker: push balance updates for all active users every 2 minutes.
 */
export function startBalanceWorker() {
  setInterval(async () => {
    const userIds = [...new Set([...clients.values()].map((c) => c.userId))]
    for (const userId of userIds) {
      const userPockets = await db.query.pockets.findMany({ where: eq(pockets.ownerId, userId) })
      for (const p of userPockets) {
        await pushBalanceUpdate(userId, p.id)
      }
    }
  }, 2 * 60_000)
}
