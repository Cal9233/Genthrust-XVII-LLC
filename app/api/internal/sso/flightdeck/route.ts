import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateSsoToken, buildFlightDeckSsoUrl } from '@/lib/sso-redirect'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.ENTRA_TENANT_ID) {
    return NextResponse.json({ error: 'SSO not configured' }, { status: 500 })
  }

  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'internal') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!session.user.email || !session.user.name) {
    return NextResponse.json({ error: 'Incomplete session' }, { status: 401 })
  }

  const token = generateSsoToken({
    email: session.user.email,
    name: session.user.name,
    role: 'owner',
    tenantId: process.env.ENTRA_TENANT_ID!,
  })

  return NextResponse.redirect(buildFlightDeckSsoUrl(token))
}
