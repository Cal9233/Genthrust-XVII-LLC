import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

interface ClientRow {
  id: number
  email: string
  password_hash: string
  name: string
  company: string | null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: { params: { scope: 'openid profile email' } },
    }),
    Credentials({
      id: 'credentials',
      name: 'Client Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const rows = await query<ClientRow[]>(
          'SELECT id, email, password_hash, name, company FROM clients WHERE email = ?',
          [email]
        )

        if (!rows.length) return null

        const client = rows[0]
        const isValid = await verifyPassword(password, client.password_hash)

        if (!isValid) return null

        return {
          id: String(client.id),
          email: client.email,
          name: client.name,
        }
      },
    }),
  ],
})
