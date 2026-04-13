import type { NextAuthConfig } from 'next-auth'

const STAFF_DOMAIN = '@genthrust.net'
const ADMIN_EMAIL = 'cmalagon@genthrust.net'

// Edge-safe config: used by middleware (no Node.js-only imports here)
// Auth is Entra ID only — only @genthrust.net staff can authenticate.
// All marketing pages are public. /api/internal/* routes self-protect via auth().
export const authConfig = {
  providers: [],
  callbacks: {
    authorized() {
      // All pages are public — API routes self-protect via auth() in each handler
      return true
    },
    async signIn({ user, profile, account }) {
      if (account?.provider !== 'microsoft-entra-id') return false

      const email =
        user?.email ||
        (profile?.preferred_username as string | undefined) ||
        (profile?.upn as string | undefined)

      if (!email || !email.toLowerCase().endsWith(STAFF_DOMAIN)) {
        return false
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account?.provider === 'microsoft-entra-id') {
        const email = (token.email as string | undefined) ?? ''
        token.role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'internal'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = token.id as string
        }
        session.user.role = token.role === 'admin' ? 'admin' : 'internal'
      }
      return session
    },
  },
} satisfies NextAuthConfig
