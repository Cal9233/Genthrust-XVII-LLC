import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams

    // Pagination
    const page = Math.max(1, parseInt(params.get('page') || '1') || 1)
    const limit = Math.min(Math.max(1, parseInt(params.get('limit') || '50') || 50), 200)
    const offset = (page - 1) * limit

    // Build WHERE clauses
    const conditions: string[] = []
    const values: any[] = []

    const addFilter = (col: string, param: string | null) => {
      if (param) {
        conditions.push(`${col} = ?`)
        values.push(param)
      }
    }

    addFilter('user_id', params.get('user_id'))
    addFilter('action', params.get('action'))
    addFilter('resource_type', params.get('resource_type'))
    addFilter('resource_id', params.get('resource_id'))
    addFilter('ip_address', params.get('ip_address'))

    const userEmail = params.get('user_email')
    if (userEmail) {
      conditions.push('user_email LIKE ?')
      values.push(`%${userEmail}%`)
    }

    const success = params.get('success')
    if (success !== null && success !== '') {
      conditions.push('success = ?')
      values.push(success === 'true' ? 1 : 0)
    }

    const startDate = params.get('start_date')
    if (startDate) {
      conditions.push('timestamp >= ?')
      values.push(startDate)
    }

    const endDate = params.get('end_date')
    if (endDate) {
      conditions.push('timestamp <= ?')
      values.push(endDate)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // Count + data in parallel
    const [countResult, logs] = await Promise.all([
      query<any[]>(`SELECT COUNT(*) as total FROM audit_logs ${where}`, values),
      query<any[]>(
        `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      ),
    ])

    const total = countResult[0]?.total ?? 0

    return NextResponse.json({ logs, total, page, limit })
  } catch (error) {
    console.error(
      'Audit log API error:',
      error instanceof Error ? { message: error.message, stack: error.stack } : error
    )
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
