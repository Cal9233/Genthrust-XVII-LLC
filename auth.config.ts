import type { NextAuthConfig } from 'next-auth'

// Edge-safe config: used by middleware (no Node.js-only imports here)
// NOTE: Audit logging for login/login-failed is added in auth.ts (non-edge)
// because logAuditEvent depends on Node.js DB driver.
export const authConfig = {
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnInternal = nextUrl.pathname.startsWith('/internal')
      const isOnPortal = nextUrl.pathname.startsWith('/portal')
      const isOnSignIn = nextUrl.pathname.startsWith('/signin')
      const isOnLogin = nextUrl.pathname.startsWith('/login')
      const isOnRegister = nextUrl.pathname.startsWith('/register')

      if (isOnInternal) {
        if (isLoggedIn) {
          const role = (auth as any)?.user?.role
          // Only admin and internal can access /internal routes
          if (role !== 'internal' && role !== 'admin') {
            // Client users must not access internal — bounce to their portal
            return Response.redirect(new URL('/portal', nextUrl))
          }
          return true
        }
        return false
      } else if (isOnPortal) {
        if (isLoggedIn) {
          const role = (auth as any)?.user?.role
          // Admin and internal users must not access portal — bounce to their dashboard
          if (role !== 'client') {
            return Response.redirect(new URL('/internal', nextUrl))
          }
          // Enforce mandatory MFA enrollment for clients
          const mfaEnabled = (auth as any)?.user?.mfaEnabled
          if (mfaEnabled === false && !nextUrl.pathname.startsWith('/portal/mfa-setup')) {
            return Response.redirect(new URL('/portal/mfa-setup', nextUrl))
          }
          return true
        }
        return Response.redirect(new URL('/login', nextUrl))
      } else if (isOnSignIn) {
        if (isLoggedIn) {
          const role = (auth as any)?.user?.role
          // Admin and internal users go straight to FlightDeck via SSO
          // Client users who somehow land here go to /portal
          return Response.redirect(
            new URL(role === 'internal' || role === 'admin' ? '/api/internal/sso/flightdeck' : '/portal', nextUrl)
          )
        }
        return true
      } else if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/portal', nextUrl))
        }
        return true
      } else if (isOnRegister) {
        if (isLoggedIn) {
          const role = (auth as any)?.user?.role
          return Response.redirect(
            new URL(role === 'internal' || role === 'admin' ? '/internal' : '/portal', nextUrl)
          )
        }
        return true
      }
      return true
    },
    async signIn({ user, profile, account }) {
      if (account?.provider === 'credentials') {
        // Credentials login audit is handled in auth.ts authorize()
        return true
      }

      const email =
        user?.email ||
        (profile?.preferred_username as string | undefined) ||
        (profile?.upn as string | undefined)

      if (!email || !email.toLowerCase().endsWith('@genthrust.net')) {
        // Entra login rejected — non-genthrust email (logged at edge, no DB access)
        return false
      }
      return true
    },
    async jwt({ token, user, account }) {
      try {
        if (user) {
          token.id = user.id
          // Carry role from user object (set by credentials authorize() from DB,
          // or determined below for Entra ID logins)
          if ('role' in user) {
            const userRole = (user as { role?: string }).role
            if (userRole === 'admin' || userRole === 'internal' || userRole === 'client') {
              token.role = userRole
            }
          }
          // Carry company info for portal users
          if ('companyId' in user) {
            token.companyId = (user as { companyId?: number | null }).companyId ?? null
            token.companyName = (user as { companyName?: string | null }).companyName ?? null
            token.erpContactId = (user as { erpContactId?: number | null }).erpContactId ?? null
          }
          // Carry MFA status
          if ('mfaEnabled' in user) {
            token.mfaEnabled = (user as { mfaEnabled?: boolean }).mfaEnabled
          }
        }
        if (account) {
          if (account.provider === 'credentials') {
            // Role is already set from user object (DB value)
            // Default to 'client' if not present (safety guard)
            if (!token.role) {
              token.role = 'client'
            }
          } else {
            // Entra ID login: determine role by email
            // cmalagon@genthrust.net → admin, all others → internal
            // Edge-safe: no DB access, role determined by email allowlist
            const email = (token.email as string | undefined) ?? ''
            token.role = email.toLowerCase() === 'cmalagon@genthrust.net' ? 'admin' : 'internal'
          }
        }
      } catch (error) {
        console.error('[auth] JWT callback error:', error)
      }
      return token
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          if (token.id) {
            session.user.id = token.id as string
          }
          // Never default to 'internal' or 'admin' — missing/unknown role is always 'client'
          const tokenRole = token.role
          if (tokenRole === 'admin') {
            session.user.role = 'admin'
          } else if (tokenRole === 'internal') {
            session.user.role = 'internal'
          } else {
            session.user.role = 'client'
          }
          session.user.mfaEnabled = token.mfaEnabled ?? undefined
          // Expose company info for portal pages (always set so portal can show appropriate UI)
          session.user.companyId = token.companyId ?? null
          session.user.companyName = token.companyName ?? null
          session.user.erpContactId = token.erpContactId ?? null
        }
      } catch (error) {
        console.error('[auth] Session callback error:', error)
      }
      return session
    },
  },
} satisfies NextAuthConfig
