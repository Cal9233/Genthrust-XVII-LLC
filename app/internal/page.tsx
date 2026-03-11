'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, Building2, Wrench, ShoppingCart, FileText,
  DollarSign, MessageSquare, FileQuestion, AlertCircle,
  RefreshCw, LayoutGrid, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis
} from 'recharts'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable, StatusBadge } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  stats: {
    totalParts: number
    totalCompanies: number
    activeROs: number
    activeSOs: number
    openInvoices: number
    openBalance: number
    pendingQuotes: number
    pendingRfqs: number
    totalDocuments: number
    catalogItems: number
  }
  recentRepairOrders: any[]
  recentSalesOrders: any[]
  recentInvoices: any[]
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

const RO_STATUS_COLORS: Record<string, string> = {
  Open: '#3b82f6',
  Active: '#6366f1',
  'In Progress': '#eab308',
  Pending: '#f59e0b',
  Shipped: '#a855f7',
  Completed: '#22c55e',
  Closed: '#94a3b8',
  Cancelled: '#ef4444',
}

const FALLBACK_COLORS = ['#3b82f6', '#6366f1', '#eab308', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#f97316']

const INVOICE_BAR_COLOR = '#6366f1'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InternalDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // ---- Data fetching ----

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  // ---- Derived chart data ----

  const roStatusData = useMemo(() => {
    if (!data?.recentRepairOrders) return []
    const counts: Record<string, number> = {}
    data.recentRepairOrders.forEach(ro => {
      const s = ro.status || 'Unknown'
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [data?.recentRepairOrders])

  const invoiceBarData = useMemo(() => {
    if (!data?.recentInvoices) return []
    return data.recentInvoices.map(inv => ({
      name: inv.invoice_no || '—',
      total: inv.total ?? 0,
      balance: inv.open_balance ?? 0,
    }))
  }, [data?.recentInvoices])

  // ---- Table column definitions ----

  const roColumns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (row: any) => <span className="font-medium text-slate-900">{row.ro_number}</span> },
    { key: 'vendor_name', label: 'Vendor', sortable: true, render: (row: any) => <span className="text-slate-600 truncate max-w-[180px] inline-block">{row.vendor_name || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', sortable: true },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (row: any) => <span className="text-slate-600">{formatDate(row.due_date)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (row: any) => <span className="font-medium">{formatCurrency(row.total)}</span> },
  ], [])

  const soColumns = useMemo(() => [
    { key: 'so_number', label: 'SO #', sortable: true, render: (row: any) => <span className="font-medium text-slate-900">{row.so_number}</span> },
    { key: 'customer_name', label: 'Customer', sortable: true, render: (row: any) => <span className="text-slate-600 truncate max-w-[180px] inline-block">{row.customer_name || '—'}</span> },
    { key: 'customer_po', label: 'PO #', sortable: true, render: (row: any) => <span className="text-slate-500">{row.customer_po || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'priority', label: 'Priority', sortable: true },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (row: any) => <span className="text-slate-600">{formatDate(row.due_date)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (row: any) => <span className="font-medium">{formatCurrency(row.total)}</span> },
  ], [])

  const invoiceColumns = useMemo(() => [
    { key: 'invoice_no', label: 'Invoice #', sortable: true, render: (row: any) => <span className="font-medium text-slate-900">{row.invoice_no}</span> },
    { key: 'account_name', label: 'Account', sortable: true, render: (row: any) => <span className="text-slate-600 truncate max-w-[200px] inline-block">{row.account_name || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'invoice_date', label: 'Issued', sortable: true, render: (row: any) => <span className="text-slate-600">{formatDate(row.invoice_date)}</span> },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (row: any) => <span className="text-slate-600">{formatDate(row.due_date)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (row: any) => <span className="font-medium">{formatCurrency(row.total)}</span> },
    { key: 'open_balance', label: 'Balance', align: 'right' as const, sortable: true, render: (row: any) => <span className="font-medium text-red-600">{row.open_balance ? formatCurrency(row.open_balance) : '—'}</span> },
  ], [])

  // ---- Loading skeleton ----

  if (loading && !data) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-36 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
          <div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCard key={i} icon={Package} label="" value="" color="slate" loading />
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="" loading><div /></ChartCard>
          <ChartCard title="" loading><div /></ChartCard>
        </div>

        {/* Tables skeleton */}
        <DataTable columns={roColumns} data={[]} loading />
      </div>
    )
  }

  // ---- Error state ----

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadDashboard} className="mt-3 text-sm text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const stats = data?.stats

  // ---- Custom tooltip for donut chart ----

  function DonutTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0]
    return (
      <div className="bg-white shadow-lg border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <span className="font-semibold text-slate-900">{d.name}</span>
        <span className="ml-2 text-slate-500">{d.value} order{d.value !== 1 ? 's' : ''}</span>
      </div>
    )
  }

  // ---- Custom tooltip for bar chart ----

  function BarTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white shadow-lg border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-slate-900 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-slate-600">
            {p.dataKey === 'total' ? 'Total' : 'Balance'}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ================================================================ */}
      {/* Header                                                          */}
      {/* ================================================================ */}

      <div
        className="flex items-center justify-between opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ================================================================ */}
      {/* Key Metrics                                                      */}
      {/* ================================================================ */}

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '60ms' }}
      >
        <SectionDivider label="Key Metrics" icon={LayoutGrid} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Parts', value: stats?.totalParts || 0, color: 'blue', delay: 80 },
          { icon: Building2, label: 'Companies', value: stats?.totalCompanies || 0, color: 'slate', delay: 120 },
          { icon: Wrench, label: 'Active ROs', value: stats?.activeROs || 0, color: 'orange', delay: 160 },
          { icon: ShoppingCart, label: 'Active SOs', value: stats?.activeSOs || 0, color: 'purple', delay: 200 },
          { icon: FileText, label: 'Open Invoices', value: stats?.openInvoices || 0, color: 'red', delay: 240 },
          { icon: DollarSign, label: 'Open Balance', value: formatCurrency(stats?.openBalance || 0), color: 'green', delay: 280 },
          { icon: MessageSquare, label: 'Pending Quotes', value: stats?.pendingQuotes || 0, color: 'teal', delay: 320 },
          { icon: FileQuestion, label: 'Pending RFQs', value: stats?.pendingRfqs || 0, color: 'indigo', delay: 360 },
        ].map(({ delay, ...cardProps }, i) => (
          <div
            key={i}
            className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
            style={{ animationDelay: `${delay}ms` }}
          >
            <StatCard {...cardProps} loading={loading} />
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* Charts                                                           */}
      {/* ================================================================ */}

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '400ms' }}
      >
        <SectionDivider label="Analytics" icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repair Order Status Donut */}
        <div
          className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
          style={{ animationDelay: '440ms' }}
        >
          <ChartCard
            title="RO Status Breakdown"
            icon={PieChartIcon}
            iconColor="text-orange-500"
            subtitle={`${data?.recentRepairOrders?.length || 0} recent orders`}
            loading={loading}
          >
            {roStatusData.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="w-48 h-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {roStatusData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={RO_STATUS_COLORS[entry.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  {roStatusData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: RO_STATUS_COLORS[entry.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                      />
                      <span className="text-slate-700 truncate">{entry.name}</span>
                      <span className="text-slate-400 ml-auto font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No repair order data available
              </div>
            )}
          </ChartCard>
        </div>

        {/* Invoice Totals Bar Chart */}
        <div
          className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
          style={{ animationDelay: '500ms' }}
        >
          <ChartCard
            title="Invoice Totals"
            icon={DollarSign}
            iconColor="text-indigo-500"
            subtitle={`${data?.recentInvoices?.length || 0} recent invoices`}
            loading={loading}
          >
            {invoiceBarData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceBarData} barCategoryGap="20%">
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                      width={50}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                    <Bar dataKey="total" fill={INVOICE_BAR_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No invoice data available
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Repair Orders Table                                              */}
      {/* ================================================================ */}

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '560ms' }}
      >
        <SectionDivider label="Repair Orders" icon={Wrench} />
      </div>

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '600ms' }}
      >
        <ChartCard
          title="Recent Repair Orders"
          icon={Wrench}
          iconColor="text-orange-500"
          subtitle={`${data?.recentRepairOrders?.length || 0} shown`}
          loading={loading}
        >
          <DataTable
            columns={roColumns}
            data={data?.recentRepairOrders || []}
            onRowClick={(row) => router.push(`/internal/repair-orders/${row.id}`)}
            emptyMessage="No repair orders"
            loading={loading}
          />
        </ChartCard>
      </div>

      {/* ================================================================ */}
      {/* Sales Orders Table                                               */}
      {/* ================================================================ */}

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '660ms' }}
      >
        <SectionDivider label="Sales Orders" icon={ShoppingCart} />
      </div>

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '700ms' }}
      >
        <ChartCard
          title="Recent Sales Orders"
          icon={ShoppingCart}
          iconColor="text-purple-500"
          subtitle={`${data?.recentSalesOrders?.length || 0} shown`}
          loading={loading}
        >
          <DataTable
            columns={soColumns}
            data={data?.recentSalesOrders || []}
            onRowClick={(row) => router.push(`/internal/sales-orders/${row.id}`)}
            emptyMessage="No sales orders"
            loading={loading}
          />
        </ChartCard>
      </div>

      {/* ================================================================ */}
      {/* Invoices Table                                                   */}
      {/* ================================================================ */}

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '760ms' }}
      >
        <SectionDivider label="Invoices" icon={FileText} />
      </div>

      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '800ms' }}
      >
        <ChartCard
          title="Recent Invoices"
          icon={FileText}
          iconColor="text-red-500"
          subtitle={`${data?.recentInvoices?.length || 0} shown`}
          loading={loading}
        >
          <DataTable
            columns={invoiceColumns}
            data={data?.recentInvoices || []}
            onRowClick={(row) => router.push(`/internal/invoices/${row.id}`)}
            emptyMessage="No invoices"
            loading={loading}
          />
        </ChartCard>
      </div>

      {/* ================================================================ */}
      {/* Fade-in keyframes (injected once)                               */}
      {/* ================================================================ */}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
