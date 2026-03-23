import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateSsoToken, buildFlightDeckSsoUrl } from '@/lib/sso-redirect'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.ENTRA_TENANT_ID) {
    return NextResponse.json({ error: 'SSO not configured' }, { status: 500 })
  }

  const session = await auth()
  const role = (session?.user as any)?.role

  if (!session?.user || (role !== 'internal' && role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!session.user.email || !session.user.name) {
    return NextResponse.json({ error: 'Incomplete session' }, { status: 401 })
  }

  // Admin → FlightDeck owner, Internal → FlightDeck sales
  const flightDeckRole = role === 'admin' ? 'owner' : 'sales'

  const token = generateSsoToken({
    email: session.user.email,
    name: session.user.name,
    role: flightDeckRole,
    tenantId: process.env.ENTRA_TENANT_ID!,
  })

  return NextResponse.redirect(buildFlightDeckSsoUrl(token))
}
