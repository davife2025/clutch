import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { authMiddleware } from '../middleware/auth.js'
import { getAgentService } from '../services/agent.service.js'

export const agentRoutes = new Hono()
agentRoutes.use('*', authMiddleware)

/**
 * POST /agent/analyze/:pocketId
 * Full pocket analysis — returns insights, health score, and suggested actions.
 */
agentRoutes.post('/analyze/:pocketId', async (c) => {
  const pocketId = c.req.param('pocketId')
  try {
    const service  = getAgentService()
    const analysis = await service.analyzeP(pocketId)
    return c.json({ data: { analysis } })
  } catch (err: any) {
    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return c.json({ error: { code: 'CONFIG_ERROR', message: 'AI agent not configured — set ANTHROPIC_API_KEY' } }, 503)
    }
    return c.json({ error: { code: 'AGENT_ERROR', message: err.message } }, 500)
  }
})

/**
 * POST /agent/resolve-payment
 * Agent picks the best wallet + chain + token for a payment intent.
 */
agentRoutes.post('/resolve-payment', async (c) => {
  const { pocketId, to, amount, token, chain, memo } = await c.req.json()

  if (!pocketId || !to || !amount || !token) {
    return c.json({ error: { code: 'VALIDATION', message: 'pocketId, to, amount, token are required' } }, 400)
  }

  try {
    const service  = getAgentService()
    const decision = await service.resolvePayment(pocketId, { to, amount, token, chain, memo })
    return c.json({ data: { decision } })
  } catch (err: any) {
    return c.json({ error: { code: 'AGENT_ERROR', message: err.message } }, 500)
  }
})

/**
 * POST /agent/chat/:pocketId
 * Streaming chat with the AI agent — Server-Sent Events.
 */
agentRoutes.post('/chat/:pocketId', async (c) => {
  const pocketId = c.req.param('pocketId')
  const { messages } = await c.req.json()

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'messages array required' } }, 400)
  }

  return streamSSE(c, async (stream) => {
    try {
      const service = getAgentService()
      for await (const chunk of service.chat(pocketId, messages)) {
        await stream.writeSSE({ data: chunk, event: 'chunk' })
      }
      await stream.writeSSE({ data: '', event: 'done' })
    } catch (err: any) {
      await stream.writeSSE({ data: err.message, event: 'error' })
    }
  })
})
