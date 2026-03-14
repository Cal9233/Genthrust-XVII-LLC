import type { NextAuthConfig } from 'next-auth'

// Edge-safe config: used by middleware (no Node.js-only imports here)
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
        if (isLoggedIn) return true
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
          return Response.redirect(new URL('/internal', nextUrl))
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
        return true
      }

      const email =
        user?.email ||
        (profile?.preferred_username as string | undefined) ||
        (profile?.upn as string | undefined)

      if (!email || !email.toLowerCase().endsWith('@genthrust.net')) {
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
            token.companyId = (user as any).companyId
            token.companyName = (user as any).companyName
            token.erpContactId = (user as any).erpContactId
          }
          // Carry MFA status
          if ('mfaEnabled' in user) {
            token.mfaEnabled = (user as any).mfaEnabled
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
          session.user.role = (token.role as 'internal' | 'client') || 'internal'
          session.user.mfaEnabled = token.mfaEnabled ?? undefined
          // Expose company info for portal pages (always set so portal can show appropriate UI)
          ;(session.user as any).companyId = token.companyId ?? null
          ;(session.user as any).companyName = token.companyName ?? null
          ;(session.user as any).erpContactId = token.erpContactId ?? null
        }
      } catch (error) {
        console.error('[auth] Session callback error:', error)
      }
      return session
    },
  },
} satisfies NextAuthConfig
