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
import { errorMiddleware }   from './middleware/error.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use('*', errorMiddleware)

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'clutch-api', version: '0.5.0', timestamp: new Date().toISOString() })
)

app.route('/health',       healthRoutes)
app.route('/auth',         authRoutes)
app.route('/pockets',      pocketRoutes)
app.route('/pockets',      walletRoutes)
app.route('/pockets',      fundsRoutes)
app.route('/balances',     balanceRoutes)
app.route('/agent',        agentRoutes)
app.route('/transactions', transactionRoutes)
app.route('/webhook',      webhookRoutes)

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

const port = Number(process.env.PORT ?? 3001)
console.log(`🫙 Clutch API v0.5.0 running on http://localhost:${port}`)

export default { port, fetch: app.fetch }
