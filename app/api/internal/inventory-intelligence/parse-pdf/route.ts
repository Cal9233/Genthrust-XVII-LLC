import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PDFParse } from 'pdf-parse'
import { parseCCheckPdf } from '@/lib/pdf-parser'
import type { ParsePdfResponse } from '@/types/pdf'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    // Parse PDF to text using pdf-parse v2 API
    const pdf = new PDFParse({ data })
    const textResult = await pdf.getText()
    await pdf.destroy()

    // Parse the extracted text into structured rows
    const rows = parseCCheckPdf(textResult.text)

    const response: ParsePdfResponse = {
      success: true,
      fileName: file.name,
      pageCount: textResult.total,
      totalRows: rows.length,
      rows,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('PDF parse error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json(
      { error: 'Failed to parse PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
