import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Session } from 'next-auth'

export type InternalAuthResult =
  | { ok: true; session: Session; role: 'admin' | 'internal' }
  | { ok: false; response: NextResponse }

/**
 * Verifies the request has an authenticated internal or admin session.
 * Usage: const result = await requireInternalSession()
 *        if (!result.ok) return result.response
 */
export async function requireInternalSession(): Promise<InternalAuthResult> {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user || (role !== 'admin' && role !== 'internal')) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, session, role }
}
