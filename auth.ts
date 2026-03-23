import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { query } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { verifyMfaChallengeToken, decryptSecret, verifyTotpCode } from '@/lib/mfa'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
import bcrypt from 'bcryptjs'

interface UsersV2Row {
  id: number
  email: string
  password_hash: string | null
  first_name: string
  last_name: string
  role: 'admin' | 'internal' | 'client'
  portal_user_id: number | null
  company_id: number | null
  erp_contact_id: number | null
  mfa_enabled: number
}

interface UsersV2WithCompanyRow extends UsersV2Row {
  company_name: string | null
}

interface MfaFactorRow {
  secret_encrypted: string
  secret_iv: string
  secret_auth_tag: string
}

interface RecoveryCodeRow {
  id: number
  code_hash: string
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: { params: { scope: 'openid profile email', prompt: 'select_account' } },
    }),
    Credentials({
      id: 'credentials',
      name: 'Client Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaToken: { label: 'MFA Token', type: 'text' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        const mfaToken = credentials?.mfaToken as string | undefined
        const totpCode = credentials?.totpCode as string | undefined

        // Helper: fire-and-forget audit for login events
        const auditLogin = (success: boolean, userEmail?: string, userId?: string, reason?: string) => {
          logAuditEvent({
            action: success ? ACTION_TYPES.LOGIN : ACTION_TYPES.LOGIN_FAILED,
            resource_type: RESOURCE_TYPES.CLIENT,
            user_email: userEmail ?? email ?? null,
            user_id: userId ?? null,
            user_role: 'client',
            success,
            error_message: reason ?? null,
            metadata: { provider: 'credentials', mfaFlow: !!(mfaToken && totpCode) },
          }).catch(() => {})
        }

        // --- Mode B: MFA token + TOTP code ---
        if (mfaToken && totpCode) {
          const challenge = verifyMfaChallengeToken(mfaToken)
          if (!challenge) return null

          // Look up the user in users_v2 by challenge userId
          const rows = await query<UsersV2WithCompanyRow[]>(
            `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role,
                    u.portal_user_id, u.company_id, u.erp_contact_id, u.mfa_enabled,
                    c.company_name
             FROM users_v2 u
             LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.id = ? AND u.is_active = 1`,
            [challenge.userId]
          )

          if (!rows.length) return null
          const user = rows[0]

          // Block internal/admin users from the MFA client flow
          if (user.email.toLowerCase().endsWith('@genthrust.net')) return null

          // H-2: Cross-check token email against DB email to prevent token reuse across accounts
          if (challenge.email.toLowerCase() !== user.email.toLowerCase()) return null

          // MFA factors are stored against portal_user_id (the legacy portal_users.id FK)
          const mfaUserId = user.portal_user_id
          if (!mfaUserId) return null

          // Get the verified TOTP factor
          const factors = await query<MfaFactorRow[]>(
            `SELECT secret_encrypted, secret_iv, secret_auth_tag
             FROM mfa_factors
             WHERE user_id = ? AND factor_type = 'totp' AND status = 'verified' AND deleted_at IS NULL`,
            [mfaUserId]
          )

          if (!factors.length) return null

          const factor = factors[0]
          const secret = decryptSecret(factor.secret_encrypted, factor.secret_iv, factor.secret_auth_tag)

          // Try TOTP code first
          let codeValid = await verifyTotpCode(secret, totpCode, String(user.id))

          // If TOTP failed, try as recovery code
          if (!codeValid) {
            const recoveryCodes = await query<RecoveryCodeRow[]>(
              `SELECT id, code_hash FROM mfa_recovery_codes
               WHERE user_id = ? AND used_at IS NULL AND deleted_at IS NULL`,
              [mfaUserId]
            )

            for (const rc of recoveryCodes) {
              if (await bcrypt.compare(totpCode.toUpperCase(), rc.code_hash)) {
                // Atomic mark-as-used: only succeeds if not already consumed by a concurrent request
                const result = await query(
                  `UPDATE mfa_recovery_codes SET used_at = NOW() WHERE id = ? AND used_at IS NULL`,
                  [rc.id]
                )
                // mysql2 returns ResultSetHeader with affectedRows for UPDATE statements
                if ((result as any).affectedRows === 1) {
                  codeValid = true
                }
                break
              }
            }
          }

          if (!codeValid) {
            auditLogin(false, user.email, String(user.id), 'Invalid TOTP/recovery code')
            return null
          }

          auditLogin(true, user.email, String(user.id))
          return {
            id: String(user.id),
            email: user.email,
            name: `${user.first_name} ${user.last_name}`.trim(),
            role: user.role,
            companyId: user.company_id,
            companyName: user.company_name,
            erpContactId: user.erp_contact_id,
            mfaEnabled: true,
          }
        }

        // --- Mode A: email + password ---
        if (!email || !password) return null

        // Block internal/admin (@genthrust.net) users from client login flow —
        // they must use /signin (Microsoft Entra) instead
        if (email.toLowerCase().endsWith('@genthrust.net')) return null

        const rows = await query<UsersV2WithCompanyRow[]>(
          `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role,
                  u.portal_user_id, u.company_id, u.erp_contact_id, u.mfa_enabled,
                  c.company_name
           FROM users_v2 u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.email = ? AND u.is_active = 1`,
          [email]
        )

        if (!rows.length) return null

        const user = rows[0]
        if (!user.password_hash) return null

        const isValid = await verifyPassword(password, user.password_hash)

        if (!isValid) {
          auditLogin(false, email, String(user.id), 'Invalid password')
          return null
        }

        // If MFA is enabled, block Mode A login — must use two-step flow
        if (user.mfa_enabled === 1) return null

        auditLogin(true, user.email, String(user.id))
        return {
          id: String(user.id),
          email: user.email,
          name: `${user.first_name} ${user.last_name}`.trim(),
          role: user.role,
          companyId: user.company_id,
          companyName: user.company_name,
          erpContactId: user.erp_contact_id,
          mfaEnabled: false,
        }
      },
    }),
  ],
})
