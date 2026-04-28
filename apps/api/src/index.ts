import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes }        from './routes/auth.js'
import { pocketRoutes }      from './routes/pocket.js'
import { walletRoutes }      from './routes/wallet.js'
import { agentRoutes }       from './routes/agent.js'
import { transactionRoutes } from './routes/transactions.js'
import { balanceRoutes }     from './routes/balance.js'
import { healthRoutes }      from './routes/health.js'
import { fundsRoutes }       from './routes/funds.js'
import { webhookRoutes }     from './routes/webhook.js'
import { payRoutes }         from './routes/pay.js'
import { defiRoutes }        from './routes/defi.js'
import { wsRoutes }          from './routes/ws.js'
import { pushRoutes }        from './routes/push.js'
import { teamRoutes }        from './routes/team.js'
import { proposalRoutes }    from './routes/proposals.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { analyticsRoutes }    from './routes/analytics.js'
import { errorMiddleware }   from './middleware/error.js'
import { startPollers }      from './services/realtime.service.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use('*', errorMiddleware)

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'clutch-api', version: '0.14.0', timestamp: new Date().toISOString() })
)

app.route('/health',       healthRoutes)
app.route('/auth',         authRoutes)
app.route('/pockets',      pocketRoutes)
app.route('/pockets',      walletRoutes)
app.route('/pockets',      fundsRoutes)
app.route('/pockets',      payRoutes)
app.route('/balances',     balanceRoutes)
app.route('/agent',        agentRoutes)
app.route('/transactions', transactionRoutes)
app.route('/webhook',      webhookRoutes)
app.route('/defi',         defiRoutes)
app.route('/ws',           wsRoutes)
app.route('/push',         pushRoutes)
app.route('/team',         teamRoutes)
app.route('/proposals',    proposalRoutes)
app.route('/subscriptions', subscriptionRoutes)
app.route('/analytics',    analyticsRoutes)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

// Start real-time pollers
startPollers()

const port = Number(process.env.PORT ?? 3001)
console.log(`🫙  Clutch API v0.14.0  →  http://localhost:${port}`)
console.log(`   WebSocket          →  ws://localhost:${port}/ws`)

export default { port, fetch: app.fetch }
