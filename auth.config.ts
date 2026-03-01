import type { NextAuthConfig } from 'next-auth'

// Edge-safe config: used by middleware (no Node.js-only imports here)
export const authConfig = {
  pages: {
    signIn: '/signin',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnInternal = nextUrl.pathname.startsWith('/internal')
      const isOnPortal = nextUrl.pathname.startsWith('/portal')
      const isOnSignIn = nextUrl.pathname.startsWith('/signin')
      const isOnLogin = nextUrl.pathname.startsWith('/login')

      if (isOnInternal) {
        if (isLoggedIn) return true
        return false
      } else if (isOnPortal) {
        if (isLoggedIn) return true
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
      if (user) {
        token.id = user.id
      }
      if (account) {
        token.role = account.provider === 'credentials' ? 'client' : 'internal'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = token.id as string
        }
        session.user.role = (token.role as 'internal' | 'client') || 'internal'
      }
      return session
    },
  },
} satisfies NextAuthConfig
