'use client'

import { useState, useCallback, useMemo } from 'react'
import { Search, CheckSquare, Square, Pencil, Check, X } from 'lucide-react'
import type { ParsedPdfRow } from '@/types/pdf'

interface PdfReviewTableProps {
  rows: ParsedPdfRow[]
  fileName: string
  pageCount: number
  onSearch: (rows: ParsedPdfRow[]) => void
  onReset: () => void
}

const TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  work_request: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'WR' },
  task_card: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'TC' },
  engine_change: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'ENG' },
}

export function PdfReviewTable({ rows: initialRows, fileName, pageCount, onSearch, onReset }: PdfReviewTableProps) {
  const [rows, setRows] = useState<ParsedPdfRow[]>(initialRows)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const selectedCount = useMemo(() => rows.filter(r => r.selected).length, [rows])
  const allSelected = selectedCount === rows.length
  const noneSelected = selectedCount === 0

  const toggleAll = useCallback(() => {
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))
  }, [allSelected])

  const toggleRow = useCallback((id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r))
  }, [])

  const startEdit = useCallback((id: string, currentPn: string) => {
    setEditingId(id)
    setEditValue(currentPn)
  }, [])

  const confirmEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      setRows(prev => prev.map(r =>
        r.id === editingId ? { ...r, partNumber: editValue.trim().toUpperCase() } : r
      ))
    }
    setEditingId(null)
    setEditValue('')
  }, [editingId, editValue])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmEdit()
    if (e.key === 'Escape') cancelEdit()
  }, [confirmEdit, cancelEdit])

  const handleSearch = useCallback(() => {
    const selected = rows.filter(r => r.selected)
    onSearch(selected)
  }, [rows, onSearch])

  return (
    <div>
      {/* Header info */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{fileName}</span>
            {' '}&middot; {pageCount} pages &middot; {rows.length} parts extracted
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedCount} of {rows.length} rows selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left w-10">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600">
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ref</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Part Number</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ALT PNs</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Qty</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const badge = TYPE_BADGES[row.referenceType] || TYPE_BADGES.work_request
                const isEditing = editingId === row.id

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${row.selected ? 'bg-white' : 'bg-slate-50/50 opacity-60'}`}
                  >
                    <td className="px-3 py-2">
                      <button onClick={() => toggleRow(row.id)} className="text-slate-400 hover:text-slate-600">
                        {row.selected ? (
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs font-mono">{row.reference || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-36 px-2 py-1 text-xs font-mono border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={confirmEdit} className="text-green-500 hover:text-green-600">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="text-red-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row.id, row.partNumber)}
                          className="group flex items-center gap-1 font-medium font-mono text-slate-900 hover:text-blue-600"
                        >
                          {row.partNumber}
                          <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.altPartNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.altPartNumbers.map((alt, idx) => (
                            <span key={idx} className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-500">
                              {alt}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">{row.name || row.description || '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{row.qty}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.unit}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with search button */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <button
          onClick={handleSearch}
          disabled={noneSelected}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search className="w-4 h-4" />
          Search Inventory ({selectedCount} parts)
        </button>
      </div>
    </div>
  )
}
