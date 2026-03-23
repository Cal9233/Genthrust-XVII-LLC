import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchErpParts } from '@/lib/erp-client'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1') || 1

    if (!q.trim()) {
      return NextResponse.json({ query: '', count: 0, parts: [] })
    }

    const result = await searchErpParts(q, page)

    return NextResponse.json(result)
  } catch (error) {
    console.error('ERP search proxy error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('AbortError') ||
      error.message.includes('timeout')
    )
    return NextResponse.json(
      { error: isConnError ? 'ERP service unavailable' : 'Failed to search ERP parts' },
      { status: isConnError ? 503 : 500 }
    )
  }
}
