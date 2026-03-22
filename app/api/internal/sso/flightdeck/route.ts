import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateSsoToken, buildFlightDeckSsoUrl } from '@/lib/sso-redirect'

export const dynamic = 'force-dynamic'

export async function GET() {
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
    tenantId: '52596c51-0a48-402a-9c2f-1ae331b2af36',
  })

  return NextResponse.redirect(buildFlightDeckSsoUrl(token))
}
