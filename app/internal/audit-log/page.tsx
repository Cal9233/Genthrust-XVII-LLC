'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Shield,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  User,
  Globe,
  Terminal,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { ChartCard } from '@/components/internal/ChartCard'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable } from '@/components/internal/DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEvent {
  id: string
  timestamp: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  method: string | null
  path: string | null
  status_code: number | null
  success: boolean
  error_message: string | null
  metadata: Record<string, unknown> | null
  duration_ms: number | null
}

interface AuditResponse {
  logs: AuditEvent[]
  total: number
  page: number
  limit: number
}

interface Filters {
  user_email: string
  action: string
  resource_type: string
  start_date: string
  end_date: string
  success: '' | 'true' | 'false'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'VIEW',
  'EXPORT',
  'SEND_EMAIL',
  'AI_CHAT',
  'RATE_LIMIT',
  'PASSWORD_RESET',
  'PERMISSION_CHANGE',
]

const RESOURCE_TYPES = [
  'repair_order',
  'sales_order',
  'invoice',
  'quote',
  'client',
  'user',
  'inventory',
  'bot',
  'automation',
  'report',
  'email_template',
  'system',
]

const LIMIT = 25

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function getActionBadgeClass(action: string): string {
  const a = action.toUpperCase()
  if (a === 'DELETE') return 'bg-red-50 text-red-700 border-red-200'
  if (a === 'CREATE') return 'bg-green-50 text-green-700 border-green-200'
  if (a === 'UPDATE') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (a === 'LOGIN' || a === 'LOGOUT') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (a === 'SEND_EMAIL') return 'bg-purple-50 text-purple-700 border-purple-200'
  if (a === 'AI_CHAT') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (a === 'RATE_LIMIT') return 'bg-orange-50 text-orange-700 border-orange-200'
  if (a === 'EXPORT') return 'bg-teal-50 text-teal-700 border-teal-200'
  if (a === 'VIEW') return 'bg-slate-50 text-slate-600 border-slate-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function getActionDotClass(action: string): string {
  const a = action.toUpperCase()
  if (a === 'DELETE') return 'bg-red-500'
  if (a === 'CREATE') return 'bg-green-500'
  if (a === 'UPDATE') return 'bg-amber-500'
  if (a === 'LOGIN' || a === 'LOGOUT') return 'bg-blue-500'
  if (a === 'SEND_EMAIL') return 'bg-purple-500'
  if (a === 'AI_CHAT') return 'bg-indigo-500'
  if (a === 'RATE_LIMIT') return 'bg-orange-500'
  if (a === 'EXPORT') return 'bg-teal-500'
  return 'bg-slate-400'
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeClass(action)}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${getActionDotClass(action)}`} />
      {action}
    </span>
  )
}

function StatusBadge({ success, code }: { success: boolean; code: number | null }) {
  if (success) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {code ?? 'OK'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
      <XCircle className="w-3.5 h-3.5" />
      {code ?? 'ERR'}
    </span>
  )
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return (
    <span className="flex flex-col">
      <span className="text-xs font-medium text-slate-800">
        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
      <span className="text-[10px] text-slate-400 tabular-nums">
        {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </span>
  )
}

function DurationPill({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-slate-400 text-xs">—</span>
  const color = ms > 2000 ? 'text-red-600' : ms > 500 ? 'text-amber-600' : 'text-slate-500'
  return <span className={`text-xs tabular-nums font-mono ${color}`}>{ms}ms</span>
}

// ─── Expanded Row Detail ───────────────────────────────────────────────────────

function ExpandedRow({ row }: { row: AuditEvent }) {
  return (
    <tr className="bg-slate-50/80 border-b border-slate-100">
      <td colSpan={8} className="px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {/* Identity */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3 h-3" /> Identity
            </p>
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">User ID</span>
                <span className="text-xs font-mono text-slate-700">{row.user_id ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Email</span>
                <span className="text-xs text-slate-700">{row.user_email ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Role</span>
                <span className="text-xs text-slate-700">{row.user_role ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Network */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3 h-3" /> Network
            </p>
            <div className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">IP Address</span>
                <span className="text-xs font-mono text-slate-700">{row.ip_address ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Method</span>
                <span className="text-xs font-mono font-bold text-slate-700">{row.method ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Path</span>
                <span className="text-xs font-mono text-slate-700 truncate max-w-[160px]" title={row.path ?? ''}>
                  {row.path ?? '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3 h-3" /> Client
            </p>
            <p className="text-[10px] font-mono text-slate-500 break-all leading-relaxed">
              {row.user_agent ?? '—'}
            </p>
          </div>

          {/* Error */}
          {row.error_message && (
            <div className="md:col-span-2 lg:col-span-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Error
              </p>
              <p className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-all">
                {row.error_message}
              </p>
            </div>
          )}

          {/* Metadata */}
          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <div className="md:col-span-2 lg:col-span-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Metadata
              </p>
              <pre className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 overflow-x-auto max-h-40">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────

function selectClass() {
  return 'h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-colors'
}

function inputClass() {
  return 'h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-colors'
}

interface FilterBarProps {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  onReset: () => void
  loading: boolean
}

function FilterBar({ filters, onChange, onReset, loading }: FilterBarProps) {
  const hasFilters = Object.values(filters).some((v) => v !== '')

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Email search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            User Email
          </label>
          <input
            type="text"
            placeholder="filter by email…"
            value={filters.user_email}
            onChange={(e) => onChange({ user_email: e.target.value })}
            className={inputClass()}
          />
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Action
          </label>
          <select
            value={filters.action}
            onChange={(e) => onChange({ action: e.target.value })}
            className={selectClass()}
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Resource type */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Resource Type
          </label>
          <select
            value={filters.resource_type}
            onChange={(e) => onChange({ resource_type: e.target.value })}
            className={selectClass()}
          >
            <option value="">All resources</option>
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            From
          </label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
            className={inputClass()}
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            To
          </label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
            className={inputClass()}
          />
        </div>

        {/* Success filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Status
          </label>
          <select
            value={filters.success}
            onChange={(e) => onChange({ success: e.target.value as Filters['success'] })}
            className={selectClass()}
          >
            <option value="">All</option>
            <option value="true">Success only</option>
            <option value="false">Failures only</option>
          </select>
        </div>

        {/* Reset */}
        {hasFilters && (
          <button
            onClick={onReset}
            disabled={loading}
            className="h-9 inline-flex items-center gap-1.5 px-3 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
  loading: boolean
}

function Pagination({ page, total, limit, onChange, loading }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-xs text-slate-500 tabular-nums">
        {total === 0 ? 'No results' : `${start}–${end} of ${total.toLocaleString()} events`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1 || loading}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              disabled={loading}
              className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-lg transition-colors ${
                p === page
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 disabled:opacity-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages || loading}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = {
  user_email: '',
  action: '',
  resource_type: '',
  start_date: '',
  end_date: '',
  success: '',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  // Derived stats from current page
  const failures = logs.filter((l) => !l.success).length
  const uniqueUsers = new Set(logs.map((l) => l.user_email).filter(Boolean)).size

  const fetchLogs = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      if (f.user_email) params.set('user_email', f.user_email)
      if (f.action) params.set('action', f.action)
      if (f.resource_type) params.set('resource_type', f.resource_type)
      if (f.start_date) params.set('start_date', f.start_date)
      if (f.end_date) params.set('end_date', f.end_date)
      if (f.success !== '') params.set('success', f.success)

      const res = await fetch(`/api/internal/audit-log?${params.toString()}`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const json: AuditResponse = await res.json()
      setLogs(json.logs)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce email filter
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchLogs(filters, 1)
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filters, fetchLogs])

  useEffect(() => {
    fetchLogs(filters, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [loading])

  function handleFilterChange(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
    setExpandedId(null)
  }

  function handlePageChange(p: number) {
    setPage(p)
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRowClick(row: AuditEvent) {
    setExpandedId((prev) => (prev === row.id ? null : row.id))
  }

  // Custom table with expandable rows
  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: false,
      render: (row: AuditEvent) => formatTs(row.timestamp),
    },
    {
      key: 'user_email',
      label: 'User',
      sortable: false,
      render: (row: AuditEvent) => (
        <span className="text-xs text-slate-700 font-medium max-w-[160px] truncate block">
          {row.user_email ?? <span className="text-slate-400 italic">anonymous</span>}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: false,
      render: (row: AuditEvent) => <ActionBadge action={row.action} />,
    },
    {
      key: 'resource_type',
      label: 'Resource',
      sortable: false,
      render: (row: AuditEvent) =>
        row.resource_type ? (
          <span className="flex flex-col">
            <span className="text-xs font-medium text-slate-700">
              {row.resource_type.replace(/_/g, ' ')}
            </span>
            {row.resource_id && (
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">
                {row.resource_id}
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key: 'path',
      label: 'Path',
      sortable: false,
      className: 'hidden lg:table-cell',
      render: (row: AuditEvent) => (
        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[180px] block">
          {row.method && (
            <span className="text-slate-400 mr-1 font-bold">{row.method}</span>
          )}
          {row.path ?? '—'}
        </span>
      ),
    },
    {
      key: 'success',
      label: 'Status',
      sortable: false,
      render: (row: AuditEvent) => <StatusBadge success={row.success} code={row.status_code} />,
    },
    {
      key: 'duration_ms',
      label: 'Duration',
      sortable: false,
      align: 'right' as const,
      render: (row: AuditEvent) => <DurationPill ms={row.duration_ms} />,
    },
    {
      key: '_expand',
      label: '',
      sortable: false,
      align: 'right' as const,
      render: (row: AuditEvent) =>
        expandedId === row.id ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ),
    },
  ]

  if (error && !logs.length && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-700 font-semibold text-lg mb-1">Unable to load audit logs</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchLogs(filters, page)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`flex items-center justify-between transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Track all system events, user actions, and security incidents.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(filters, page)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-500 delay-100 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <StatCard
          icon={Shield}
          label="Total Events"
          value={total}
          color="blue"
          subtitle="Matching current filters"
          loading={loading}
        />
        <StatCard
          icon={XCircle}
          label="Failures (this page)"
          value={failures}
          color={failures > 0 ? 'red' : 'green'}
          subtitle={`${logs.length ? Math.round((failures / logs.length) * 100) : 0}% failure rate`}
          loading={loading}
        />
        <StatCard
          icon={User}
          label="Unique Users (this page)"
          value={uniqueUsers}
          color="purple"
          subtitle="Distinct actors"
          loading={loading}
        />
      </div>

      {/* Error banner (soft) */}
      {error && logs.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div
        className={`transition-all duration-500 delay-150 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={() => {
            setFilters(EMPTY_FILTERS)
            setPage(1)
          }}
          loading={loading}
        />
      </div>

      {/* Table card */}
      <div
        className={`transition-all duration-500 delay-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <ChartCard
          title="Event Log"
          icon={Shield}
          iconColor="text-indigo-500"
          subtitle={
            loading
              ? 'Loading…'
              : `${total.toLocaleString()} event${total !== 1 ? 's' : ''} found`
          }
          action={
            <span className="text-xs text-slate-400 tabular-nums">
              Page {page} of {Math.max(1, Math.ceil(total / LIMIT))}
            </span>
          }
        >
          {/* Custom table with expandable rows */}
          {loading ? (
            <div className="animate-pulse space-y-0">
              <div className="bg-slate-50 px-4 py-3 flex gap-6 rounded-t-lg">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="h-3 bg-slate-200 rounded flex-1" />
                ))}
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-6 border-t border-slate-100">
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <div key={j} className="h-3 bg-slate-100 rounded flex-1" />
                  ))}
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No audit events found</p>
              <p className="text-xs text-slate-300">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-2.5 font-semibold text-slate-600 text-xs ${
                          col.align === 'right' ? 'text-right' : ''
                        } ${col.className || ''}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <>
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${
                          expandedId === row.id
                            ? 'bg-indigo-50/50'
                            : row.success
                            ? 'hover:bg-slate-50/60'
                            : 'bg-red-50/20 hover:bg-red-50/40'
                        }`}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 ${
                              col.align === 'right' ? 'text-right' : ''
                            } ${col.className || ''}`}
                          >
                            {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                      {expandedId === row.id && <ExpandedRow key={`expanded-${row.id}`} row={row} />}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                onChange={handlePageChange}
                loading={loading}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Legend */}
      <div
        className={`transition-all duration-500 delay-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-2">
            Action legend:
          </span>
          {[
            { label: 'Login', action: 'LOGIN' },
            { label: 'Create', action: 'CREATE' },
            { label: 'Update', action: 'UPDATE' },
            { label: 'Delete', action: 'DELETE' },
            { label: 'Email', action: 'SEND_EMAIL' },
            { label: 'AI Chat', action: 'AI_CHAT' },
            { label: 'Rate Limit', action: 'RATE_LIMIT' },
            { label: 'Export', action: 'EXPORT' },
            { label: 'View', action: 'VIEW' },
          ].map(({ label, action }) => (
            <span
              key={action}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionBadgeClass(action)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${getActionDotClass(action)}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
