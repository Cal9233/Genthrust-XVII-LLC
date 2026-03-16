'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Minus,
  Database,
  Activity,
  Package,
  Building2,
  Wrench,
  ShoppingCart,
  Receipt,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import DetailDrawer from '@/components/internal/DetailDrawer'
import { StatCard } from '@/components/internal/StatCard'
import { StatusBadge } from '@/components/internal/DataTable'
import { ChartCard } from '@/components/internal/ChartCard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wraps fetch with an AbortController timeout (default 10s). */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs = 10000, ...fetchInit } = init || {}
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...fetchInit, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out — service may be unavailable')
      }
      throw err
    })
    .finally(() => clearTimeout(timer))
}

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(val: string | null | undefined) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(val: string | null | undefined) {
  if (!val) return '—'
  const d = new Date(val)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Connection Health Card ────────────────────────────────────────────────────

interface DiagnosticsData {
  timestamp: string
  mainDb?: { connected: boolean }
  inventoryDb?: { connected: boolean }
  inventoryConnected?: boolean
}

function ConnectionHealth() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/internal/diagnostics')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const connections = [
    {
      label: 'ERP Database',
      icon: Database,
      status: loading ? 'loading' : data?.mainDb?.connected ? 'ok' : 'error',
    },
    {
      label: 'Inventory DB',
      icon: Package,
      status: loading ? 'loading' : data?.inventoryDb?.connected ? 'ok' : 'error',
    },
    {
      label: 'Portal DB',
      icon: Activity,
      status: loading ? 'loading' : data?.inventoryConnected ? 'ok' : 'error',
    },
  ]

  return (
    <ChartCard
      title="Connection Health"
      icon={Activity}
      action={
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh connections"
          className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {connections.map((c) => {
          const Icon = c.icon
          const isOk = c.status === 'ok'
          const isLoading = c.status === 'loading'
          return (
            <div
              key={c.label}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200"
            >
              <div className={`p-1.5 rounded-md ${isLoading ? 'bg-slate-200' : isOk ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <Icon className={`w-3.5 h-3.5 ${isLoading ? 'text-slate-400' : isOk ? 'text-emerald-600' : 'text-red-500'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{c.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isLoading ? (
                    <Minus className="w-3 h-3 text-slate-400" />
                  ) : isOk ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-xs ${isLoading ? 'text-slate-400' : isOk ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isLoading ? 'Checking…' : isOk ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {data?.timestamp && (
        <p className="mt-3 text-xs text-slate-400">Last checked {formatRelative(data.timestamp)}</p>
      )}
    </ChartCard>
  )
}

// ─── Parts Sync ───────────────────────────────────────────────────────────────

function PartsSync() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ count?: number; mode?: string; ts?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function triggerSync(full = false) {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(`/api/internal/sync/parts${full ? '?full=true' : ''}`, { method: 'POST', timeoutMs: 60000 })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      setResult({ count: json.count, mode: json.mode, ts: new Date().toISOString() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <ChartCard title="Parts Sync" icon={Package}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => triggerSync(false)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition-all disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Incremental Sync
          </button>
          <button
            onClick={() => triggerSync(true)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-900 text-white transition-all disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Full Sync
          </button>
        </div>

        <div className="text-xs">
          {syncing && <span className="text-blue-600 animate-pulse">Syncing parts…</span>}
          {result && !syncing && (
            <span className="text-emerald-600">
              Synced {result.count?.toLocaleString()} parts ({result.mode}) — {formatRelative(result.ts)}
            </span>
          )}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </div>
    </ChartCard>
  )
}

// ─── Key Metrics ──────────────────────────────────────────────────────────────

interface DashboardStats {
  totalParts: number
  totalCompanies: number
  activeROs: number
  activeSOs: number
  openInvoices: number
  openBalance: number
}

function KeyMetrics({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const cards = [
    { icon: Package,      label: 'Parts',         color: 'blue',   value: loading ? '—' : stats?.totalParts.toLocaleString() ?? '—' },
    { icon: Building2,    label: 'Companies',      color: 'purple', value: loading ? '—' : stats?.totalCompanies.toLocaleString() ?? '—' },
    { icon: Wrench,       label: 'Active ROs',     color: 'yellow', value: loading ? '—' : stats?.activeROs.toLocaleString() ?? '—' },
    { icon: ShoppingCart, label: 'Active SOs',     color: 'green',  value: loading ? '—' : stats?.activeSOs.toLocaleString() ?? '—' },
    { icon: Receipt,      label: 'Open Invoices',  color: 'red',    value: loading ? '—' : stats?.openInvoices.toLocaleString() ?? '—' },
    { icon: DollarSign,   label: 'AR Balance',     color: 'orange', value: loading ? '—' : formatCurrency(stats?.openBalance ?? null), subtitle: 'outstanding' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <StatCard
          key={c.label}
          icon={c.icon}
          label={c.label}
          value={c.value}
          color={c.color}
          subtitle={c.subtitle}
          loading={loading}
        />
      ))}
    </div>
  )
}

// ─── Local Data Table (server-side pagination + search) ───────────────────────

interface Column<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  className?: string
}

interface LocalDataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  total: number
  page: number
  limit: number
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onPageChange: (p: number) => void
  onRowClick: (row: T) => void
  rowKey: (row: T) => string | number
  searchPlaceholder?: string
  emptyLabel?: string
}

function LocalDataTable<T>({
  columns, data, total, page, limit, loading, search,
  onSearchChange, onPageChange, onRowClick, rowKey,
  searchPlaceholder = 'Search…', emptyLabel = 'No records',
}: LocalDataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap ${col.className || ''}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 text-xs">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick(row)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
        <span>
          {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Drawer helpers ───────────────────────────────────────────────────────────

function DrawerLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-slate-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading {label}…
      </div>
    </div>
  )
}

function DrawerError({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-red-600 text-sm">{label}</p>
    </div>
  )
}

function DrawerMetaGrid({ fields }: { fields: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(({ label, value }) => (
        <div key={label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
          <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
          <div className="text-sm text-slate-900">{value || '—'}</div>
        </div>
      ))}
    </div>
  )
}

function DrawerLineItems({
  lines,
  columns,
  renderRow,
}: {
  lines: any[]
  columns: string[]
  renderRow: (line: any) => React.ReactNode[]
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Line Items</h3>
        <span className="text-xs text-slate-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-5 text-center text-slate-400">
                    No line items
                  </td>
                </tr>
              ) : (
                lines.map((line, i) => {
                  const cells = renderRow(line)
                  return (
                    <tr key={line.id ?? i} className="hover:bg-slate-50">
                      {cells.map((cell, j) => (
                        <td key={j} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Content: Repair Order ─────────────────────────────────────────────

function RepairOrderDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ order: any; lines: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    fetchWithTimeout(`/api/internal/repair-orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : 'Failed to load')
        return r.json()
      })
      .then((json) => { setData(json); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [id])

  if (loading) return <DrawerLoading label="repair order" />
  if (error || !data) return <DrawerError label={error || 'Failed to load'} />

  const { order, lines } = data
  return (
    <div className="space-y-5">
      <DrawerMetaGrid fields={[
        { label: 'RO Number',    value: order.ro_number },
        { label: 'Status',       value: <StatusBadge status={order.status} /> },
        { label: 'Vendor',       value: order.vendor_name },
        { label: 'Contact',      value: order.contact_name },
        { label: 'Priority',     value: order.priority },
        { label: 'Due Date',     value: formatDate(order.due_date) },
        { label: 'Ship Via',     value: order.ship_via },
        { label: 'Ship Account', value: order.ship_account },
        { label: 'Terms',        value: order.term_sale },
        { label: 'Total',        value: <span className="text-slate-900 font-bold">{formatCurrency(order.total)}</span> },
      ]} />
      <DrawerLineItems
        lines={lines}
        columns={['#', 'Part', 'Description', 'Cond', 'Serial #', 'Qty', 'Rcvd', 'Dlvd', 'Price', 'UOM']}
        renderRow={(line) => [
          line.line_number,
          <span className="font-medium text-slate-900">{line.part_name || '—'}</span>,
          <span className="text-slate-500 max-w-[160px] truncate block">{line.description || '—'}</span>,
          line.condition_code || '—',
          line.serial_number || '—',
          line.qty ?? '—',
          line.qty_received ?? '—',
          line.qty_delivered ?? '—',
          formatCurrency(line.unit_price),
          line.uom || '—',
        ]}
      />
    </div>
  )
}

// ─── Detail Content: Sales Order ──────────────────────────────────────────────

function SalesOrderDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ order: any; lines: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    fetchWithTimeout(`/api/internal/sales-orders/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : 'Failed to load')
        return r.json()
      })
      .then((json) => { setData(json); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [id])

  if (loading) return <DrawerLoading label="sales order" />
  if (error || !data) return <DrawerError label={error || 'Failed to load'} />

  const { order, lines } = data
  return (
    <div className="space-y-5">
      <DrawerMetaGrid fields={[
        { label: 'SO Number',    value: order.so_number },
        { label: 'Status',       value: <StatusBadge status={order.status} /> },
        { label: 'Customer',     value: order.customer_name },
        { label: 'Customer PO',  value: order.customer_po },
        { label: 'Contact',      value: order.contact_name },
        { label: 'Priority',     value: order.priority },
        { label: 'Due Date',     value: formatDate(order.due_date) },
        { label: 'Ship Via',     value: order.ship_via },
        { label: 'Tracking #',   value: order.track_no },
        { label: 'Subtotal',     value: formatCurrency(order.subtotal) },
        { label: 'Discount',     value: formatCurrency(order.total_discount) },
        { label: 'Total',        value: <span className="text-slate-900 font-bold">{formatCurrency(order.total)}</span> },
      ]} />
      <DrawerLineItems
        lines={lines}
        columns={['#', 'Part', 'Description', 'Cond', 'Serial #', 'Qty', 'Rcvd', 'Dlvd', 'Price', 'UOM']}
        renderRow={(line) => [
          line.line_number,
          <span className="font-medium text-slate-900">{line.part_name || '—'}</span>,
          <span className="text-slate-500 max-w-[160px] truncate block">{line.description || '—'}</span>,
          line.condition_code || '—',
          line.serial_number || '—',
          line.qty ?? '—',
          line.qty_received ?? '—',
          line.qty_delivered ?? '—',
          formatCurrency(line.unit_price),
          line.uom || '—',
        ]}
      />
    </div>
  )
}

// ─── Detail Content: Invoice ──────────────────────────────────────────────────

function InvoiceDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ invoice: any; lines: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    fetchWithTimeout(`/api/internal/invoices/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : 'Failed to load')
        return r.json()
      })
      .then((json) => { setData(json); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [id])

  if (loading) return <DrawerLoading label="invoice" />
  if (error || !data) return <DrawerError label={error || 'Failed to load'} />

  const { invoice, lines } = data
  return (
    <div className="space-y-5">
      <DrawerMetaGrid fields={[
        { label: 'Invoice #',    value: invoice.invoice_no },
        { label: 'Status',       value: <StatusBadge status={invoice.status} /> },
        { label: 'Account',      value: invoice.account_name },
        { label: 'Contact',      value: invoice.contact_name },
        { label: 'SO #',         value: invoice.so_number },
        { label: 'Customer PO',  value: invoice.customer_po },
        { label: 'Invoice Date', value: formatDate(invoice.invoice_date) },
        { label: 'Due Date',     value: formatDate(invoice.due_date) },
        { label: 'Ship Via',     value: invoice.ship_via },
        { label: 'Tracking #',   value: invoice.track_no },
        { label: 'Subtotal',     value: formatCurrency(invoice.subtotal) },
        { label: 'Discount',     value: formatCurrency(invoice.total_discount) },
        { label: 'Total',        value: <span className="text-slate-900 font-bold">{formatCurrency(invoice.total)}</span> },
        {
          label: 'Open Balance',
          value: invoice.open_balance
            ? <span className="text-red-600 font-bold">{formatCurrency(invoice.open_balance)}</span>
            : '—',
        },
      ]} />
      <DrawerLineItems
        lines={lines}
        columns={['#', 'Part', 'Description', 'Cond', 'Serial #', 'Qty', 'Price', 'UOM']}
        renderRow={(line) => [
          line.line_number,
          <span className="font-medium text-slate-900">{line.part_name || '—'}</span>,
          <span className="text-slate-500 max-w-[160px] truncate block">{line.description || '—'}</span>,
          line.condition_code || '—',
          line.serial_number || '—',
          line.qty ?? '—',
          formatCurrency(line.unit_price),
          line.uom || '—',
        ]}
      />
    </div>
  )
}

// ─── Repair Orders Table Section ──────────────────────────────────────────────

function RepairOrdersSection() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (search) params.set('search', search)
      const res = await fetchWithTimeout(`/api/internal/repair-orders?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  // Debounce search → reset page
  useEffect(() => {
    const t = setTimeout(() => { setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const columns = [
    {
      key: 'ro_number', label: 'RO #',
      render: (row: any) => <span className="font-mono text-blue-600 text-xs font-medium">{row.ro_number}</span>,
    },
    {
      key: 'vendor_name', label: 'Vendor',
      render: (row: any) => <span className="text-slate-900 text-xs">{row.vendor_name || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      key: 'priority', label: 'Priority',
      render: (row: any) => <span className="text-slate-500 text-xs">{row.priority || '—'}</span>,
    },
    {
      key: 'due_date', label: 'Due',
      render: (row: any) => <span className="text-slate-500 text-xs">{formatDate(row.due_date)}</span>,
    },
    {
      key: 'total', label: 'Total',
      render: (row: any) => <span className="text-slate-900 text-xs font-medium">{formatCurrency(row.total)}</span>,
      className: 'text-right',
    },
    {
      key: 'line_count', label: 'Lines',
      render: (row: any) => <span className="text-slate-400 text-xs">{row.line_count}</span>,
      className: 'text-right',
    },
  ]

  return (
    <>
      <ChartCard title="Repair Orders" icon={Wrench}>
        <LocalDataTable
          columns={columns}
          data={data}
          total={total}
          page={page}
          limit={25}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onRowClick={(row) => { setSelectedId(String(row.id)); setDrawerOpen(true) }}
          rowKey={(row) => row.id}
          searchPlaceholder="Search by RO # or vendor…"
          emptyLabel="No repair orders found"
        />
      </ChartCard>

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedId ? (data.find((r) => String(r.id) === selectedId)?.ro_number ?? 'Repair Order') : 'Repair Order'}
        subtitle="Repair Order Detail"
      >
        {selectedId && <RepairOrderDetail id={selectedId} />}
      </DetailDrawer>
    </>
  )
}

// ─── Sales Orders Table Section ───────────────────────────────────────────────

function SalesOrdersSection() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (search) params.set('search', search)
      const res = await fetchWithTimeout(`/api/internal/sales-orders?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300)
    return () => clearTimeout(t)
  }, [search])

  const columns = [
    {
      key: 'so_number', label: 'SO #',
      render: (row: any) => <span className="font-mono text-blue-600 text-xs font-medium">{row.so_number}</span>,
    },
    {
      key: 'customer_name', label: 'Customer',
      render: (row: any) => <span className="text-slate-900 text-xs">{row.customer_name || '—'}</span>,
    },
    {
      key: 'customer_po', label: 'PO #',
      render: (row: any) => <span className="text-slate-500 text-xs">{row.customer_po || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      key: 'due_date', label: 'Due',
      render: (row: any) => <span className="text-slate-500 text-xs">{formatDate(row.due_date)}</span>,
    },
    {
      key: 'total', label: 'Total',
      render: (row: any) => <span className="text-slate-900 text-xs font-medium">{formatCurrency(row.total)}</span>,
      className: 'text-right',
    },
    {
      key: 'line_count', label: 'Lines',
      render: (row: any) => <span className="text-slate-400 text-xs">{row.line_count}</span>,
      className: 'text-right',
    },
  ]

  return (
    <>
      <ChartCard title="Sales Orders" icon={ShoppingCart}>
        <LocalDataTable
          columns={columns}
          data={data}
          total={total}
          page={page}
          limit={25}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onRowClick={(row) => { setSelectedId(String(row.id)); setDrawerOpen(true) }}
          rowKey={(row) => row.id}
          searchPlaceholder="Search by SO #, customer, or PO #…"
          emptyLabel="No sales orders found"
        />
      </ChartCard>

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedId ? (data.find((r) => String(r.id) === selectedId)?.so_number ?? 'Sales Order') : 'Sales Order'}
        subtitle="Sales Order Detail"
      >
        {selectedId && <SalesOrderDetail id={selectedId} />}
      </DetailDrawer>
    </>
  )
}

// ─── Invoices Table Section ───────────────────────────────────────────────────

function InvoicesSection() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (search) params.set('search', search)
      const res = await fetchWithTimeout(`/api/internal/invoices?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300)
    return () => clearTimeout(t)
  }, [search])

  const columns = [
    {
      key: 'invoice_no', label: 'Invoice #',
      render: (row: any) => <span className="font-mono text-blue-600 text-xs font-medium">{row.invoice_no}</span>,
    },
    {
      key: 'account_name', label: 'Account',
      render: (row: any) => <span className="text-slate-900 text-xs">{row.account_name || '—'}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      key: 'invoice_date', label: 'Invoice Date',
      render: (row: any) => <span className="text-slate-500 text-xs">{formatDate(row.invoice_date)}</span>,
    },
    {
      key: 'due_date', label: 'Due',
      render: (row: any) => <span className="text-slate-500 text-xs">{formatDate(row.due_date)}</span>,
    },
    {
      key: 'total', label: 'Total',
      render: (row: any) => <span className="text-slate-900 text-xs font-medium">{formatCurrency(row.total)}</span>,
      className: 'text-right',
    },
    {
      key: 'open_balance', label: 'Open Bal.',
      render: (row: any) => (
        <span className={`text-xs font-medium ${row.open_balance ? 'text-red-600' : 'text-slate-400'}`}>
          {row.open_balance ? formatCurrency(row.open_balance) : '—'}
        </span>
      ),
      className: 'text-right',
    },
  ]

  return (
    <>
      <ChartCard title="Invoices" icon={Receipt}>
        <LocalDataTable
          columns={columns}
          data={data}
          total={total}
          page={page}
          limit={25}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onPageChange={setPage}
          onRowClick={(row) => { setSelectedId(String(row.id)); setDrawerOpen(true) }}
          rowKey={(row) => row.id}
          searchPlaceholder="Search by invoice #, account, or PO #…"
          emptyLabel="No invoices found"
        />
      </ChartCard>

      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedId ? (data.find((r) => String(r.id) === selectedId)?.invoice_no ?? 'Invoice') : 'Invoice'}
        subtitle="Invoice Detail"
      >
        {selectedId && <InvoiceDetail id={selectedId} />}
      </DetailDrawer>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ERPPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    fetchWithTimeout('/api/internal/dashboard')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.stats) setStats(json.stats)
        setStatsLoading(false)
      })
      .catch(() => setStatsLoading(false))
  }, [])

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <div className="opacity-0 animate-[fadeInUp_0.35s_ease_forwards]" style={{ animationDelay: '0ms' }}>
        <h1 className="text-3xl font-extrabold text-slate-900">ERP</h1>
        <p className="text-slate-500 mt-1 text-sm">Connection status, sync, and order management</p>
      </div>

      {/* Row 1: Health + Sync */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-0 animate-[fadeInUp_0.35s_ease_forwards]"
        style={{ animationDelay: '60ms' }}
      >
        <ConnectionHealth />
        <PartsSync />
      </div>

      {/* Row 2: Key Metrics */}
      <div className="opacity-0 animate-[fadeInUp_0.35s_ease_forwards]" style={{ animationDelay: '120ms' }}>
        <KeyMetrics stats={stats} loading={statsLoading} />
      </div>

      {/* Row 3: Repair Orders */}
      <div className="opacity-0 animate-[fadeInUp_0.35s_ease_forwards]" style={{ animationDelay: '180ms' }}>
        <RepairOrdersSection />
      </div>

      {/* Row 4: Sales Orders */}
      <div className="opacity-0 animate-[fadeInUp_0.35s_ease_forwards]" style={{ animationDelay: '220ms' }}>
        <SalesOrdersSection />
      </div>

      {/* Row 5: Invoices */}
      <div className="opacity-0 animate-[fadeInUp_0.35s_ease_forwards]" style={{ animationDelay: '260ms' }}>
        <InvoicesSection />
      </div>
    </div>
  )
}
