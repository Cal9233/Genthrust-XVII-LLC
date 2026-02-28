import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

export const authConfig = {
  pages: {
    signIn: '/signin',
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: { params: { scope: 'openid profile email' } },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnInternal = nextUrl.pathname.startsWith('/internal')
      const isOnSignIn = nextUrl.pathname.startsWith('/signin')

      if (isOnInternal) {
        if (isLoggedIn) return true
        return false
      } else if (isOnSignIn) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/internal', nextUrl))
        }
        return true
      }
      return true
    },
    async signIn({ user, profile }) {
      // Defense in depth: Check all possible Entra ID email fields
      const email =
        user?.email ||
        (profile?.preferred_username as string | undefined) ||
        (profile?.upn as string | undefined)

      if (!email || !email.toLowerCase().endsWith('@genthrust.net')) {
        return false
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
} satisfies NextAuthConfig
