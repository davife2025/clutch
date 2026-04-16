import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.js'
import { pocketRoutes } from './routes/pocket.js'
import { walletRoutes } from './routes/wallet.js'
import { agentRoutes } from './routes/agent.js'
import { transactionRoutes } from './routes/transactions.js'
import { errorMiddleware } from './middleware/error.js'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use('*', errorMiddleware)

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'clutch-api', version: '0.1.0', timestamp: new Date().toISOString() })
)

// Routes
app.route('/auth', authRoutes)
app.route('/pockets', pocketRoutes)
app.route('/pockets', walletRoutes)
app.route('/agent', agentRoutes)
app.route('/transactions', transactionRoutes)

// 404
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

const port = Number(process.env.PORT ?? 3001)
console.log(`🫙 Clutch API running on http://localhost:${port}`)

export default { port, fetch: app.fetch }
