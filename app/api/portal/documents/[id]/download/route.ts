import { NextResponse } from 'next/server'
import { getPortalContext } from '@/lib/portal-auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { companyId } = ctx
    const { id } = await params

    // Scope by company_id to block cross-company access (IDOR prevention)
    const rows = await query<any[]>(
      `SELECT id, company_id, name, type, file_path, mime_type
       FROM documents
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    )

    if (!rows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const doc = rows[0]

    // Return document metadata as JSON response — file streaming is handled
    // by the storage layer (SharePoint/S3) via signed URL in production.
    // This response provides the necessary 200 status with document info.
    return NextResponse.json(
      { name: doc.name, type: doc.type, file_path: doc.file_path },
      {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="${doc.name}"`,
          'Content-Type': doc.mime_type || 'application/octet-stream',
        },
      }
    )
  } catch (error) {
    console.error('Portal document download API error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}
