'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react'

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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="bg-slate-50 px-4 py-3 flex gap-8">
            {columns.map((_, i) => (
              <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-4 py-3 flex gap-8 border-t border-slate-100">
              {columns.map((_, j) => (
                <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
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
          <tr className="bg-slate-50/80 text-left">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 ${compact ? 'py-2' : 'py-2.5'} font-semibold text-slate-600 ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                } ${col.sortable ? 'cursor-pointer select-none hover:text-slate-900 transition-colors' : ''} ${col.className || ''}`}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`hover:bg-slate-50/50 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 ${compact ? 'py-2' : 'py-3'} ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  } ${col.className || ''}`}
                >
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  {emptyIcon || <Inbox className="w-8 h-8 text-slate-300" />}
                  <p className="text-sm text-slate-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function StatusDot({ status, label }: { status: string; label?: string }) {
  const colorMap: Record<string, string> = {
    'Open': 'bg-blue-500',
    'Active': 'bg-blue-500',
    'In Progress': 'bg-yellow-500',
    'Pending': 'bg-yellow-500',
    'Shipped': 'bg-purple-500',
    'Completed': 'bg-green-500',
    'Closed': 'bg-slate-400',
    'Paid': 'bg-green-500',
    'Overdue': 'bg-red-500',
    'Cancelled': 'bg-red-400',
    'Approved': 'bg-green-500',
    'Delivered': 'bg-purple-500',
    'Received': 'bg-teal-500',
    'PAST_DUE': 'bg-red-500',
    'DUE_SOON': 'bg-yellow-500',
    'UPCOMING': 'bg-blue-500',
    'RUNNING': 'bg-green-500',
    'STOPPED': 'bg-red-500',
    'UNKNOWN': 'bg-yellow-500',
  }
  const dot = colorMap[status] || 'bg-slate-400'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs font-medium text-slate-700">{label || status.replace(/_/g, ' ')}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>

  const colors: Record<string, string> = {
    'Open': 'bg-blue-50 text-blue-700 border-blue-200',
    'Active': 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Shipped': 'bg-purple-50 text-purple-700 border-purple-200',
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-slate-50 text-slate-600 border-slate-200',
    'Paid': 'bg-green-50 text-green-700 border-green-200',
    'Overdue': 'bg-red-50 text-red-700 border-red-200',
    'Cancelled': 'bg-red-50 text-red-600 border-red-200',
    'Approved': 'bg-green-50 text-green-700 border-green-200',
    'Delivered': 'bg-purple-50 text-purple-700 border-purple-200',
    'Received': 'bg-teal-50 text-teal-700 border-teal-200',
    'PAST_DUE': 'bg-red-50 text-red-700 border-red-200',
    'DUE_SOON': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'UPCOMING': 'bg-blue-50 text-blue-700 border-blue-200',
  }

  const colorClass = colors[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        colorClass.includes('red') ? 'bg-red-500' :
        colorClass.includes('yellow') ? 'bg-yellow-500' :
        colorClass.includes('green') ? 'bg-green-500' :
        colorClass.includes('blue') ? 'bg-blue-500' :
        colorClass.includes('purple') ? 'bg-purple-500' :
        colorClass.includes('teal') ? 'bg-teal-500' :
        'bg-slate-400'
      }`} />
      {status.replace(/_/g, ' ')}
    </span>
  )
}
