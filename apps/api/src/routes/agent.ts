import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'

export const agentRoutes = new Hono()
agentRoutes.use('*', authMiddleware)

// Agent analysis (Session 6)
agentRoutes.post('/analyze/:pocketId', async (c) => {
  return c.json({ data: { message: 'AI agent coming in Session 6' } })
})

// Agent-driven payment (Session 7)
agentRoutes.post('/pay', async (c) => {
  return c.json({ data: { message: 'x402 payments coming in Session 7' } })
})
