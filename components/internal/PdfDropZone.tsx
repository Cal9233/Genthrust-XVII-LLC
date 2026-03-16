'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react'
import type { ParsePdfResponse } from '@/types/pdf'

interface PdfDropZoneProps {
  onParsed: (response: ParsePdfResponse) => void
}

export function PdfDropZone({ onParsed }: PdfDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds 10MB limit')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/internal/inventory-intelligence/parse-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Upload failed (${res.status})`)
      }

      const data: ParsePdfResponse = await res.json()
      if (data.rows.length === 0) {
        setError('No part numbers found in this PDF. Make sure it is a C Check pre-draw document.')
        return
      }
      onParsed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF')
    } finally {
      setUploading(false)
    }
  }, [onParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
  }, [handleFile])

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
          transition-all duration-200
          ${dragging
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50'}
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600">Parsing PDF...</p>
            <p className="text-xs text-slate-400">Extracting part numbers and quantities</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`p-3 rounded-full ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {dragging ? (
                <FileText className="w-8 h-8 text-blue-500" />
              ) : (
                <Upload className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {dragging ? 'Drop PDF here' : 'Drop a C Check PDF here, or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports pre-draw pending items PDFs (max 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
