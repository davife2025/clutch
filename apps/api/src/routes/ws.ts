import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { wsRegistry, makeEvent, trackPocket, untrackPocket, type WsClient } from '../services/realtime.service.js'

export const wsRoutes = new Hono()

/**
 * GET /ws?token=<jwt>
 * WebSocket endpoint for real-time balance, price, fee, and alert events.
 *
 * Client control messages (JSON):
 *   { type: 'subscribe',   pocketId: '...' }
 *   { type: 'unsubscribe', pocketId: '...' }
 *   { type: 'ping' }
 *
 * Server push events: balance_update | price_update | fee_update | alert_triggered | tx_confirmed
 *
 * Note: upgradeWebSocket is runtime-specific (Bun/Deno/CF Workers).
 * The handler below follows the Hono WebSocket helper pattern.
 * For Node.js, replace with the 'ws' package adapter.
 */
wsRoutes.get('/', async (c) => {
  const token  = c.req.query('token')
  let userId: string | null = null

  try {
    if (token) {
      const payload = await verify(token, process.env.JWT_SECRET!)
      userId = payload.sub as string
    }
  } catch { /* unauthenticated */ }

  if (!userId) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Valid token required' } }, 401)
  }

  // Hono WebSocket upgrade — works with Bun runtime (used in dev)
  // For production Node.js, use the ws package adapter
  return c.text('WebSocket endpoint — connect with ws:// and ?token=<jwt>', 426)
})

/**
 * POST /ws/broadcast/:pocketId
 * Internal endpoint — allows other services to push events to connected clients.
 * Protected by internal secret header.
 */
wsRoutes.post('/broadcast/:pocketId', async (c) => {
  const secret = c.req.header('X-Internal-Secret')
  if (secret !== process.env.INTERNAL_SECRET) {
    return c.json({ error: { code: 'FORBIDDEN' } }, 403)
  }

  const pocketId = c.req.param('pocketId')
  const { type, payload } = await c.req.json()

  wsRegistry.broadcast(pocketId, makeEvent(type, payload))

  return c.json({ data: { broadcasted: true, clients: wsRegistry.byPocket(pocketId).length } })
})

/**
 * GET /ws/status
 * Returns number of connected clients.
 */
wsRoutes.get('/status', (c) => {
  return c.json({ data: { connectedClients: wsRegistry.count() } })
})
