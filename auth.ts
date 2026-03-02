import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

interface PortalUserRow {
  id: number
  email: string
  password_hash: string
  contact_name: string
  company_id: number | null
  company_name: string | null
  erp_contact_id: number | null
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

        const rows = await query<PortalUserRow[]>(
          `SELECT pu.id, pu.email, pu.password_hash, pu.contact_name, pu.company_id,
                  pu.erp_contact_id, c.company_name
           FROM portal_users pu
           LEFT JOIN companies c ON pu.company_id = c.id
           WHERE pu.email = ? AND pu.is_active = 1`,
          [email]
        )

        if (!rows.length) return null

        const user = rows[0]
        const isValid = await verifyPassword(password, user.password_hash)

        if (!isValid) return null

        return {
          id: String(user.id),
          email: user.email,
          name: user.contact_name,
          companyId: user.company_id,
          companyName: user.company_name,
          erpContactId: user.erp_contact_id,
        }
      },
    }),
  ],
})
