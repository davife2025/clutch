import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { notificationsService } from '../services/notifications.service.js'

export const notificationRoutes = new Hono()
notificationRoutes.use('*', authMiddleware)

/** POST /notifications/token — register an Expo push token */
notificationRoutes.post('/token', async (c) => {
  const userId   = c.get('userId') as string
  const { token } = await c.req.json()
  if (!token?.startsWith('ExponentPushToken')) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid Expo push token' } }, 400)
  }
  notificationsService.registerToken(userId, token)
  return c.json({ data: { registered: true } })
})

/** DELETE /notifications/token — deregister on logout */
notificationRoutes.delete('/token', async (c) => {
  const userId   = c.get('userId') as string
  const { token } = await c.req.json()
  notificationsService.removeToken(userId, token)
  return c.json({ data: { removed: true } })
})

/** POST /notifications/test — send a test push (dev only) */
notificationRoutes.post('/test', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Test endpoint disabled in production' } }, 403)
  }
  const userId = c.get('userId') as string
  await notificationsService.sendToUser(userId, {
    title: 'Clutch test notification',
    body:  'Push notifications are working!',
    data:  { type: 'test' },
  })
  return c.json({ data: { sent: true } })
})
