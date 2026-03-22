import { auth } from '@/auth'
import { query } from '@/lib/db'

export interface PortalContext {
  userId: string
  companyId: number
  companyName: string
}

/**
 * Resolves the authenticated portal context for a request.
 *
 * Validates that:
 *   1. A session exists
 *   2. The session role is exactly 'client'
 *   3. A numeric companyId is present on the token
 *   4. The companyId maps to a real row in the companies table
 *
 * Returns null for any failure — callers must respond with 401/403.
 * Using companyId (numeric PK) as the authoritative identity prevents IDOR
 * via companyName string collisions or session tampering.
 */
export async function getPortalContext(): Promise<PortalContext | null> {
  const session = await auth()
  if (!session?.user) return null
  if ((session.user as any).role !== 'client') return null

  const companyId = (session.user as any).companyId
  if (!companyId || typeof companyId !== 'number') return null

  const rows = await query<{ company_name: string }[]>(
    'SELECT company_name FROM companies WHERE id = ? LIMIT 1',
    [companyId]
  )
  if (!rows.length) return null

  return { userId: session.user.id!, companyId, companyName: rows[0].company_name }
}
