import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { pushService } from '../services/push.service.js'
import {
  sessionManager, parseWcUri, parseSolanaWalletUri,
  type DappPermission, type ConnectedDapp,
} from '@clutch/walletconnect'

export const dappRoutes = new Hono()
dappRoutes.use('*', authMiddleware)

// ── Sessions ──────────────────────────────────────────────────────────────────

/**
 * GET /dapps/sessions
 * List all connected dApp sessions for the user.
 */
dappRoutes.get('/sessions', async (c) => {
  const sessions = sessionManager.listSessions()
  return c.json({ data: { sessions } })
})

/**
 * DELETE /dapps/sessions/:sessionId
 * Disconnect a dApp session.
 */
dappRoutes.delete('/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const removed   = sessionManager.disconnect(sessionId)
  return c.json({ data: { disconnected: removed } })
})

/**
 * DELETE /dapps/sessions
 * Disconnect all dApp sessions.
 */
dappRoutes.delete('/sessions', async (c) => {
  sessionManager.disconnectAll()
  return c.json({ data: { disconnected: true } })
})

// ── Connection ────────────────────────────────────────────────────────────────

/**
 * POST /dapps/connect
 * Handle a WalletConnect URI or Solana Wallet Adapter URI.
 * Queues a connect request for the user to approve in the UI.
 */
dappRoutes.post('/connect', async (c) => {
  const userId = c.get('userId') as string
  const { uri, walletAddress } = await c.req.json()

  if (!uri) {
    return c.json({ error: { code: 'VALIDATION', message: 'uri required' } }, 400)
  }

  // Parse WalletConnect URI
  const wc = parseWcUri(uri)
  if (wc) {
    const request = sessionManager.queueRequest({
      type: 'connect',
      payload: {
        dappOrigin: `wc:${wc.topic}`,
        name:       `WalletConnect dApp (${wc.topic.slice(0, 8)}...)`,
        requestedPermissions: ['sign_transaction', 'sign_message'] as DappPermission[],
      },
    })
    return c.json({ data: { requestId: request.id, type: 'walletconnect', topic: wc.topic } })
  }

  // Parse Solana Mobile Wallet Adapter URI
  const swa = parseSolanaWalletUri(uri)
  if (swa) {
    const request = sessionManager.queueRequest({
      type: 'connect',
      payload: {
        dappOrigin: swa.appUrl,
        name:       swa.label ?? new URL(swa.appUrl).hostname,
        requestedPermissions: ['sign_transaction', 'sign_message'] as DappPermission[],
      },
    })
    return c.json({ data: { requestId: request.id, type: 'solana-wallet-adapter', appUrl: swa.appUrl } })
  }

  return c.json({ error: { code: 'INVALID_URI', message: 'Unrecognised connection URI format' } }, 400)
})

/**
 * POST /dapps/connect/approve/:requestId
 * User approves a connect request — creates a session.
 */
dappRoutes.post('/connect/approve/:requestId', async (c) => {
  const requestId    = c.req.param('requestId')
  const { walletAddress, permissions } = await c.req.json()

  const request = sessionManager.resolveRequest(requestId)
  if (!request || request.type !== 'connect') {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found or already resolved' } }, 404)
  }

  const payload = request.payload as any

  const session = sessionManager.connect({
    origin:      payload.dappOrigin,
    name:        payload.name,
    iconUrl:     payload.iconUrl,
    accounts:    [walletAddress],
    permissions: permissions ?? payload.requestedPermissions,
  })

  return c.json({ data: { session } })
})

/**
 * POST /dapps/connect/reject/:requestId
 * User rejects a connect request.
 */
dappRoutes.post('/connect/reject/:requestId', async (c) => {
  const requestId = c.req.param('requestId')
  sessionManager.resolveRequest(requestId)
  return c.json({ data: { rejected: true } })
})

// ── Pending signing requests ──────────────────────────────────────────────────

/**
 * GET /dapps/requests
 * Get pending sign requests from connected dApps.
 */
dappRoutes.get('/requests', async (c) => {
  const pending = sessionManager.getPendingRequests()
  return c.json({ data: { requests: pending, count: pending.length } })
})

/**
 * POST /dapps/requests/approve/:requestId
 * Approve a sign request — returns the signed payload for the dApp.
 * Actual signing happens on the client (private key never touches server).
 */
dappRoutes.post('/requests/approve/:requestId', async (c) => {
  const requestId = c.req.param('requestId')
  const { signedResult } = await c.req.json()

  const request = sessionManager.resolveRequest(requestId)
  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404)
  }

  return c.json({
    data: {
      requestId,
      type:   request.type,
      result: signedResult,
      ts:     new Date().toISOString(),
    }
  })
})

/**
 * POST /dapps/requests/reject/:requestId
 */
dappRoutes.post('/requests/reject/:requestId', async (c) => {
  const requestId = c.req.param('requestId')
  sessionManager.resolveRequest(requestId)
  return c.json({ data: { rejected: true } })
})

/**
 * POST /dapps/request-sign
 * dApp submits a sign request to the Clutch user.
 * In production this comes through the WalletConnect relay, not directly.
 */
dappRoutes.post('/request-sign', async (c) => {
  const { sessionId, type, payload } = await c.req.json()

  const session = sessionManager.getSession(sessionId)
  if (!session) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404)
  }

  const permission: DappPermission =
    type === 'sign_message' ? 'sign_message' : 'sign_transaction'

  if (!session.permissions.includes(permission)) {
    return c.json({ error: { code: 'FORBIDDEN', message: `Session does not have ${permission} permission` } }, 403)
  }

  const request = sessionManager.queueRequest({ type, payload: { ...payload, dappOrigin: session.origin } })

  return c.json({ data: { requestId: request.id, pending: true } })
})
