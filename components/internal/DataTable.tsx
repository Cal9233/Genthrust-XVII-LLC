'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react'

// Re-export StatusBadge and StatusDot from the canonical file so callers can
// import either from DataTable (backwards-compat) or StatusBadge directly.
export { StatusBadge, StatusDot } from './StatusBadge'

interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  loading?: boolean
  compact?: boolean
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  emptyIcon,
  loading,
  compact,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (loading) {
    return (
      <div className="overflow-hidden">
        <div className="animate-pulse">
          {/* Skeleton header */}
          <div className="bg-[#161b22] px-4 py-2.5 flex gap-8 border-b border-white/[0.06]">
            {columns.map((_, i) => (
              <div key={i} className="h-3 bg-white/[0.06] rounded flex-1" />
            ))}
          </div>
          {/* Skeleton rows */}
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-4 py-3 flex gap-8 border-b border-white/[0.04]">
              {columns.map((_, j) => (
                <div key={j} className="h-4 bg-white/[0.04] rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#161b22] text-left border-b border-white/[0.06]">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 ${compact ? 'py-2' : 'py-2.5'}
                  text-[10px] font-medium text-[#8b949e] uppercase tracking-wider
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                  ${col.sortable ? 'cursor-pointer select-none hover:text-[#f0f6fc] transition-colors' : ''}
                  ${col.className || ''}`}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      : <ChevronsUpDown className="w-3 h-3 text-[#484f58]" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`hover:bg-white/[0.03] transition-colors duration-100
                ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 ${compact ? 'py-2' : 'py-3'}
                    text-sm text-[#f0f6fc]
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                    ${col.className || ''}`}
                >
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon || <Inbox className="w-10 h-10 text-[#484f58]" />}
                  <p className="text-sm text-[#484f58]">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
