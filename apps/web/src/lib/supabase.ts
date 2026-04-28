/**
 * Supabase client helpers for Next.js 14 (App Router).
 *
 * Three patterns:
 *   createBrowserClient()  — client components, runs in browser
 *   createServerClient()   — server components, server actions, route handlers
 *   createMiddlewareClient() — Next.js middleware (edge runtime)
 */

import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'
import { createServerClient as _createServerClient }   from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (client components) ────────────────────────────────────────

export function createBrowserClient() {
  return _createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// ── Server client (server components, server actions, API routes) ─────────────

export function createServerClient() {
  const cookieStore = cookies()

  return _createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server component — cookies can't be set; handled by middleware
        }
      },
    },
  })
}

// ── Middleware client ─────────────────────────────────────────────────────────

export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = _createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  return { supabase, response }
}
