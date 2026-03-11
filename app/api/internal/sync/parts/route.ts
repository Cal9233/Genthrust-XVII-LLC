import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncParts } from '@/scripts/sync-parts'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const fullSync = searchParams.get('full') === 'true'

    const count = await syncParts(fullSync)

    return NextResponse.json({
      success: true,
      message: `Parts sync complete`,
      count,
      mode: fullSync ? 'full' : 'incremental',
    })
  } catch (error) {
    console.error('Parts sync API error:', error)
    return NextResponse.json(
      { error: 'Parts sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
