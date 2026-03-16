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
          if (role !== 'internal') {
            // Client users must not access internal — bounce to their portal
            return Response.redirect(new URL('/portal', nextUrl))
          }
          return true
        }
        return false
      } else if (isOnPortal) {
        if (isLoggedIn) {
          // Enforce mandatory MFA enrollment for clients
          const role = (auth as any)?.user?.role
          const mfaEnabled = (auth as any)?.user?.mfaEnabled
          if (role === 'client' && mfaEnabled === false && !nextUrl.pathname.startsWith('/portal/mfa-setup')) {
            return Response.redirect(new URL('/portal/mfa-setup', nextUrl))
          }
          return true
        }
        return Response.redirect(new URL('/login', nextUrl))
      } else if (isOnSignIn) {
        if (isLoggedIn) {
          const role = (auth as any)?.user?.role
          // Only internal users should be redirected to /internal from /signin
          // Client users who somehow land here go to /portal
          return Response.redirect(new URL(role === 'internal' ? '/internal' : '/portal', nextUrl))
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
          return Response.redirect(new URL(role === 'internal' ? '/internal' : '/portal', nextUrl))
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
          token.role = account.provider === 'credentials' ? 'client' : 'internal'
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
          // Never default to 'internal' — missing/unknown role is always 'client'
          session.user.role = (token.role === 'internal' ? 'internal' : 'client')
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
