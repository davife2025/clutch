import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from '../../routes/auth.js'

/**
 * Auth route integration tests.
 * Uses an in-memory mock DB — no real Postgres needed.
 */

vi.mock('../../db/client.js', () => {
  const users = new Map<string, any>()
  return {
    db: {
      query: {
        users: {
          findFirst: async ({ where }: any) => {
            for (const user of users.values()) {
              if (user.email === where?.config?.value) return user
            }
            return null
          },
        },
      },
      insert: () => ({
        values: (data: any) => ({
          returning: async () => {
            const user = { id: 'test-id-' + Date.now(), ...data, createdAt: new Date(), updatedAt: new Date() }
            users.set(user.id, user)
            return [user]
          },
        }),
      }),
    },
  }
})

const app = new Hono()
app.route('/auth', authRoutes)

async function post(path: string, body: object) {
  const req = new Request(`http://test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return app.fetch(req)
}

describe('POST /auth/register', () => {
  it('returns 201 with token on success', async () => {
    const res  = await post('/auth/register', { email: 'test@example.com', password: 'password123' })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.data.token).toBeDefined()
    expect(json.data.userId).toBeDefined()
  })

  it('returns 400 when email missing', async () => {
    const res = await post('/auth/register', { password: 'password123' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password missing', async () => {
    const res = await post('/auth/register', { email: 'test@example.com' })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns 401 for unknown email', async () => {
    const res = await post('/auth/login', { email: 'nobody@example.com', password: 'pass' })
    expect(res.status).toBe(401)
  })
})
