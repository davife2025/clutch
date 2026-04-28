import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { pushService } from '../services/push.service.js'

export const pushRoutes = new Hono()
pushRoutes.use('*', authMiddleware)

/**
 * POST /push/register
 * Register a device push token for the authenticated user.
 */
pushRoutes.post('/register', async (c) => {
  const userId = c.get('userId') as string
  const { token, platform } = await c.req.json()

  if (!token || !platform) {
    return c.json({ error: { code: 'VALIDATION', message: 'token and platform required' } }, 400)
  }

  if (!['ios', 'android', 'web'].includes(platform)) {
    return c.json({ error: { code: 'VALIDATION', message: 'platform must be ios, android, or web' } }, 400)
  }

  pushService.registerToken(userId, token, platform)
  return c.json({ data: { registered: true } })
})

/**
 * DELETE /push/token
 * Remove a push token (e.g. on logout).
 */
pushRoutes.delete('/token', async (c) => {
  const userId = c.get('userId') as string
  const { token } = await c.req.json()
  if (!token) return c.json({ error: { code: 'VALIDATION', message: 'token required' } }, 400)
  pushService.removeToken(userId, token)
  return c.json({ data: { removed: true } })
})

/**
 * GET /push/tokens
 * List registered tokens for the user (for debugging).
 */
pushRoutes.get('/tokens', async (c) => {
  const userId = c.get('userId') as string
  const tokens = pushService.getTokens(userId).map((t) => ({
    platform:  t.platform,
    createdAt: t.createdAt,
    // Don't expose raw token to client
    preview:   t.token.slice(0, 20) + '...',
  }))
  return c.json({ data: { tokens } })
})

/**
 * POST /push/test
 * Send a test notification (dev only).
 */
pushRoutes.post('/test', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Test notifications disabled in production' } }, 403)
  }
  const userId = c.get('userId') as string
  const results = await pushService.notifyUser(
    userId,
    'Clutch test notification',
    'Push notifications are working!',
    { test: true }
  )
  return c.json({ data: { results } })
})
