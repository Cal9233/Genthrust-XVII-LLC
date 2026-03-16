import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'

export default NextAuth(authConfig).auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const isProtectedApi =
    pathname.startsWith('/api/internal') || pathname.startsWith('/api/portal')

  // For unauthenticated API route requests, return 401 JSON instead of redirecting to login
  if (!req.auth && isProtectedApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // For page routes, fall through to the authorized() callback in auth.config.ts
  // which handles role-based redirects and MFA enforcement
})

export const config = {
  matcher: [
    '/internal/:path*',
    '/signin',
    '/portal/:path*',
    '/login',
    '/register',
    '/api/internal/:path*',
    '/api/portal/:path*',
  ],
}
