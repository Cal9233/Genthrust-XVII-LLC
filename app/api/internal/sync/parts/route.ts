import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncParts } from '@/scripts/sync-parts'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
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
    // H-6: Return 409 when advisory lock is held by a concurrent sync
    if (error instanceof Error && error.message === 'Another parts sync is already in progress') {
      return NextResponse.json(
        { error: 'Conflict', details: 'A parts sync is already in progress' },
        { status: 409 }
      )
    }
    console.error('Parts sync API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json(
      { error: 'Parts sync failed', details: 'Internal sync error' },
      { status: 500 }
    )
  }
}
