import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId } = ctx
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const conditions: string[] = ['company_id = ?']
    const params: any[] = [companyId]

    if (type) {
      conditions.push('type = ?')
      params.push(type)
    }

    const where = conditions.join(' AND ')

    const documents = await query<any[]>(
      `SELECT id, company_id, name, type, created_at
       FROM documents
       WHERE ${where}
       ORDER BY created_at DESC`,
      params
    )

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Portal documents list API error:', error)
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
  }
}
