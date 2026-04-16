import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { hash, compare } from 'bcryptjs'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export const authRoutes = new Hono()

authRoutes.post('/register', async (c) => {
  const { email, password } = await c.req.json()

  if (!email || !password) {
    return c.json({ error: { code: 'VALIDATION', message: 'Email and password required' } }, 400)
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'Email already registered' } }, 409)
  }

  const passwordHash = await hash(password, 12)
  const [user] = await db.insert(users).values({ email, passwordHash }).returning()

  const token = await sign(
    { sub: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!
  )

  return c.json({ data: { token, userId: user.id } }, 201)
})

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json()

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401)
  }

  const valid = await compare(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401)
  }

  const token = await sign(
    { sub: user.id, email: user.email, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET!
  )

  return c.json({ data: { token, userId: user.id } })
})
