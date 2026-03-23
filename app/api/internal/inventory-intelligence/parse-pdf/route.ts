import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { parseCCheckPdf } from '@/lib/pdf-parser'
import type { ParsePdfResponse } from '@/types/pdf'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()

    // Validate PDF magic bytes (%PDF-) to prevent disguised file uploads
    const header = new Uint8Array(arrayBuffer.slice(0, 5))
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D] // %PDF-
    if (!pdfMagic.every((b, i) => header[i] === b)) {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
    }

    const data = new Uint8Array(arrayBuffer)

    // Dynamic import avoids Next.js static-analysis ESM interop issues.
    // pdf-parse v2 exposes PDFParse as a named export (no default export in CJS bundle).
    const { PDFParse } = await import('pdf-parse')
    const pdf = new PDFParse({ data })
    let textResult: Awaited<ReturnType<typeof pdf.getText>>
    try {
      textResult = await pdf.getText()
    } finally {
      await pdf.destroy()
    }

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
      { error: 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}
