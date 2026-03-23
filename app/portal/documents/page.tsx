'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, FolderOpen, Download } from 'lucide-react'

interface Document {
  id: number
  filename: string
  doc_type: string | null
  related_order: string | null
  created_at: string | null
  file_size: number | null
}

interface ApiResponse {
  documents: Document[]
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFileSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-xs text-slate-400">—</span>
  const styles: Record<string, string> = {
    '8130-3': 'bg-blue-100 text-blue-700',
    'COC': 'bg-purple-100 text-purple-700',
    'Invoice': 'bg-green-100 text-green-700',
    'Packing Slip': 'bg-orange-100 text-orange-700',
  }
  const colorClass = styles[type] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {type}
    </span>
  )
}

const TYPE_FILTERS = ['All', '8130-3', 'COC', 'Invoice', 'Packing Slip']

export default function DocumentsPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeType, setActiveType] = useState('All')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeType !== 'All') params.set('type', activeType)
      const res = await fetch(`/api/portal/documents?${params}`)
      if (!res.ok) throw new Error('Failed to load documents')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeType])

  useEffect(() => { load() }, [load])

  const documents = data?.documents ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${documents.length.toLocaleString()} document${documents.length !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Type filter tabs */}
        <div className="px-4 pt-3 border-b border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Filter documents by type">
            {TYPE_FILTERS.map((type) => (
              <button
                key={type}
                role="tab"
                aria-selected={activeType === type}
                onClick={() => setActiveType(type)}
                className={[
                  'px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600/30',
                  activeType === type
                    ? 'border-navy-600 text-navy-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={load} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Documents">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Filename</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Related Order</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Size</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy-900 max-w-[260px] truncate">
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3"><DocTypeBadge type={doc.doc_type} /></td>
                    <td className="px-4 py-3 text-slate-600">{doc.related_order || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/portal/documents/${doc.id}/download`}
                        download={doc.filename}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy-700 bg-navy-50 border border-navy-200 rounded-lg hover:bg-navy-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600/30"
                        aria-label={`Download ${doc.filename}`}
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400">No documents found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
