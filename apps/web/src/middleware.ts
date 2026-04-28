import { type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  // Refresh the session so it doesn't expire mid-use.
  // This also reads from cookies and syncs the Supabase auth state.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
