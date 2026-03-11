'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  RefreshCw, AlertCircle, Zap, DollarSign, FileText,
  Wrench, ShoppingCart, ChevronDown, ChevronRight, Play,
  Clock, CalendarClock, Timer, TrendingUp
} from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable, StatusBadge } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Net30Order {
  ro_number: string
  ro_id: number | string
  vendor: string
  total: number
  payment_terms: string
  received_date: string | null
  payment_due_date: string | null
  status_flag: 'PAST_DUE' | 'DUE_SOON' | 'UPCOMING' | null
  days_overdue?: number
  days_until_due?: number
}

interface FollowupRO {
  ro_number: string
  ro_id: number | string
  vendor: string
  status: string
  total: number
  payment_terms: string | null
}

interface PurchaseOrder {
  po_number: string
  vendor: string
  po_date: string | null
  total: number
  status: string
  payment_terms: string | null
  due_date: string | null
}

interface RepairOrderERP {
  ro_number: string
  vendor: string
  status: string
  due_date: string | null
  total: number
}

interface AutomationData {
  net30: {
    summary: { past_due: number; due_soon: number; upcoming: number }
    orders: Net30Order[]
  }
  followups: {
    statuses: { Approved: number; Delivered: number }
    orders: FollowupRO[]
  }
  purchaseOrders: PurchaseOrder[]
  repairOrders: RepairOrderERP[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '\u2014'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(val: string | null) {
  if (!val) return '\u2014'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Animation wrapper
// ---------------------------------------------------------------------------

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={`animate-fadeIn opacity-0 ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NET30 Payment Timeline Bar
// ---------------------------------------------------------------------------

function PaymentTimelineBar({ order }: { order: Net30Order }) {
  const termDays = parseInt(order.payment_terms?.replace(/\D/g, '') || '30', 10) || 30

  let elapsed = termDays
  if (order.days_until_due !== undefined) {
    elapsed = termDays - order.days_until_due
  } else if (order.days_overdue !== undefined) {
    elapsed = termDays + order.days_overdue
  }

  const pct = Math.min(Math.max((elapsed / termDays) * 100, 0), 100)
  const overflow = order.days_overdue !== undefined ? Math.min((order.days_overdue / termDays) * 100, 40) : 0

  const barColor =
    order.status_flag === 'PAST_DUE'
      ? 'bg-red-500'
      : order.status_flag === 'DUE_SOON'
        ? 'bg-yellow-500'
        : 'bg-blue-500'

  const bgTrack =
    order.status_flag === 'PAST_DUE'
      ? 'bg-red-100'
      : order.status_flag === 'DUE_SOON'
        ? 'bg-yellow-100'
        : 'bg-blue-100'

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className={`relative flex-1 h-2 rounded-full ${bgTrack} overflow-hidden`}>
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
        {overflow > 0 && (
          <div
            className="absolute top-0 h-full bg-red-600/60 rounded-r-full"
            style={{ left: '100%', width: `${overflow}%`, marginLeft: '-1px' }}
          />
        )}
      </div>
      <span className="text-[10px] font-mono text-slate-400 w-8 text-right shrink-0">
        {order.days_overdue !== undefined
          ? <span className="text-red-600">+{order.days_overdue}</span>
          : order.days_until_due !== undefined
            ? <span className={order.days_until_due <= 7 ? 'text-yellow-600' : 'text-slate-500'}>{order.days_until_due}d</span>
            : '\u2014'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress Summary Bar (segmented)
// ---------------------------------------------------------------------------

function ProgressSummaryBar({ pastDue, dueSoon, upcoming }: { pastDue: number; dueSoon: number; upcoming: number }) {
  const total = pastDue + dueSoon + upcoming
  if (total === 0) return null

  const segments = [
    { count: pastDue, color: 'bg-red-500', label: 'Past Due', textColor: 'text-red-700', dotColor: 'bg-red-500' },
    { count: dueSoon, color: 'bg-yellow-400', label: 'Due Soon', textColor: 'text-yellow-700', dotColor: 'bg-yellow-500' },
    { count: upcoming, color: 'bg-blue-500', label: 'Upcoming', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
  ]

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        {segments.map((seg, i) =>
          seg.count > 0 ? (
            <div
              key={i}
              className={`${seg.color} transition-all duration-700 ${i === 0 ? 'rounded-l-full' : ''} ${
                i === segments.length - 1 || segments.slice(i + 1).every(s => s.count === 0) ? 'rounded-r-full' : ''
              }`}
              style={{ width: `${(seg.count / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        {segments.map((seg, i) => (
          <span key={i} className={`inline-flex items-center gap-1.5 ${seg.textColor}`}>
            <span className={`w-2 h-2 rounded-full ${seg.dotColor}`} />
            <span className="font-semibold">{seg.count}</span>
            <span className="text-slate-500">{seg.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JSON Syntax Highlighted Viewer
// ---------------------------------------------------------------------------

function JsonHighlighted({ data }: { data: any }) {
  const lines = useMemo(() => {
    const raw = JSON.stringify(data, null, 2)
    return raw.split('\n')
  }, [data])

  function renderLine(line: string, idx: number) {
    // Match JSON key
    const keyMatch = line.match(/^(\s*)"([^"]+)"(:)/)
    if (keyMatch) {
      const [, indent, key, colon] = keyMatch
      const rest = line.slice(keyMatch[0].length)
      return (
        <span key={idx}>
          {indent}
          <span className="text-purple-400">&quot;{key}&quot;</span>
          <span className="text-slate-500">{colon}</span>
          {renderValue(rest)}
          {'\n'}
        </span>
      )
    }
    return <span key={idx}>{renderValue(line)}{'\n'}</span>
  }

  function renderValue(fragment: string): React.ReactNode {
    // string value
    const strMatch = fragment.match(/^(\s*)"([^"]*)"(.*)$/)
    if (strMatch) {
      const [, ws, val, trail] = strMatch
      return <>{ws}<span className="text-green-400">&quot;{val}&quot;</span><span className="text-slate-500">{trail}</span></>
    }
    // number value
    const numMatch = fragment.match(/^(\s*)(-?\d+\.?\d*)(,?)(.*)$/)
    if (numMatch) {
      const [, ws, num, comma, rest] = numMatch
      return <>{ws}<span className="text-amber-400">{num}</span><span className="text-slate-500">{comma}</span>{rest}</>
    }
    // boolean / null
    const boolMatch = fragment.match(/^(\s*)(true|false|null)(,?)(.*)$/)
    if (boolMatch) {
      const [, ws, val, comma, rest] = boolMatch
      return <>{ws}<span className="text-cyan-400">{val}</span><span className="text-slate-500">{comma}</span>{rest}</>
    }
    return <span className="text-slate-400">{fragment}</span>
  }

  return (
    <div className="bg-slate-900 rounded-lg p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
      <pre className="text-xs font-mono leading-relaxed">
        {lines.map((line, i) => renderLine(line, i))}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton placeholders
// ---------------------------------------------------------------------------

function StatCardSkeletonRow({ count }: { count: number }) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 rounded-xl border border-slate-200/60 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div className="flex-1">
              <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
              <div className="h-6 w-20 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AutomationPage() {
  const [data, setData] = useState<AutomationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/automation')
      if (!res.ok) throw new Error('Failed to load automation data')
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function runPreview(type: string) {
    setPreviewType(type)
    setPreviewLoading(true)
    setPreviewResult(null)
    try {
      const res = await fetch(`/api/internal/automation/preview?type=${type}`)
      setPreviewResult(await res.json())
    } catch (err) {
      setPreviewResult({ error: 'Preview request failed' })
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // -- Column definitions --------------------------------------------------

  const net30Columns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: Net30Order) => <span className="font-semibold text-slate-900">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: Net30Order) => <span className="text-slate-600 truncate block max-w-[180px]">{r.vendor}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: Net30Order) => <span className="font-medium">{formatCurrency(r.total)}</span> },
    { key: 'payment_terms', label: 'Terms', sortable: true },
    { key: 'received_date', label: 'Received', sortable: true, render: (r: Net30Order) => formatDate(r.received_date) },
    { key: 'payment_due_date', label: 'Due Date', sortable: true, render: (r: Net30Order) => formatDate(r.payment_due_date) },
    { key: 'status_flag', label: 'Status', sortable: true, render: (r: Net30Order) => <StatusBadge status={r.status_flag} /> },
    { key: 'timeline', label: 'Timeline', render: (r: Net30Order) => <PaymentTimelineBar order={r} /> },
  ], [])

  const followupColumns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: FollowupRO) => <span className="font-semibold text-slate-900">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: FollowupRO) => <span className="text-slate-600 truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: FollowupRO) => <StatusBadge status={r.status} /> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: FollowupRO) => <span className="font-medium">{formatCurrency(r.total)}</span> },
    { key: 'payment_terms', label: 'Terms', sortable: true, render: (r: FollowupRO) => r.payment_terms || '\u2014' },
  ], [])

  const poColumns = useMemo(() => [
    { key: 'po_number', label: 'PO #', sortable: true, render: (r: PurchaseOrder) => <span className="font-semibold text-slate-900">{r.po_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: PurchaseOrder) => <span className="text-slate-600 truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'po_date', label: 'Date', sortable: true, render: (r: PurchaseOrder) => formatDate(r.po_date) },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: PurchaseOrder) => <span className="font-medium">{formatCurrency(r.total)}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: PurchaseOrder) => <StatusBadge status={r.status} /> },
    { key: 'payment_terms', label: 'Terms', sortable: true, render: (r: PurchaseOrder) => r.payment_terms || '\u2014' },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (r: PurchaseOrder) => formatDate(r.due_date) },
  ], [])

  const roColumns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: RepairOrderERP) => <span className="font-semibold text-slate-900">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: RepairOrderERP) => <span className="text-slate-600 truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: RepairOrderERP) => <StatusBadge status={r.status} /> },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (r: RepairOrderERP) => formatDate(r.due_date) },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: RepairOrderERP) => <span className="font-medium">{formatCurrency(r.total)}</span> },
  ], [])

  // -- Derived values -------------------------------------------------------

  const net30 = data?.net30
  const followups = data?.followups
  const totalNet30Value = useMemo(() => net30?.orders.reduce((s, o) => s + (o.total || 0), 0) || 0, [net30])

  // -- Full skeleton --------------------------------------------------------

  if (loading && !data) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between animate-pulse">
          <div>
            <div className="h-8 w-72 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-48 bg-slate-100 rounded" />
          </div>
          <div className="h-10 w-24 bg-slate-200 rounded-lg" />
        </div>

        <StatCardSkeletonRow count={4} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-5 w-52 bg-slate-200 rounded" />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-3 w-full bg-slate-100 rounded" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-6">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <StatCardSkeletonRow count={2} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="h-5 w-44 bg-slate-200 rounded" />
          </div>
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-6">
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // -- Error state ----------------------------------------------------------

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-600 font-semibold text-lg mb-1">Failed to Load Data</p>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // -- Main render ----------------------------------------------------------

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>

      <div className="space-y-8">
        {/* ================================================================
            HEADER
        ================================================================ */}
        <FadeIn delay={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ERP Automation Dashboard
              </h1>
              <p className="text-slate-500 mt-1 text-sm flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </FadeIn>

        {/* ================================================================
            TOP-LEVEL STAT CARDS
        ================================================================ */}
        <FadeIn delay={80}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={AlertCircle}
              label="Past Due"
              value={net30?.summary.past_due || 0}
              color="red"
              subtitle="Overdue payments"
              loading={loading}
            />
            <StatCard
              icon={Timer}
              label="Due Soon (7d)"
              value={net30?.summary.due_soon || 0}
              color="yellow"
              subtitle="Approaching deadline"
              loading={loading}
            />
            <StatCard
              icon={CalendarClock}
              label="Upcoming"
              value={net30?.summary.upcoming || 0}
              color="blue"
              subtitle="Future payments"
              loading={loading}
            />
            <StatCard
              icon={TrendingUp}
              label="NET30 Total"
              value={formatCurrency(totalNet30Value)}
              color="green"
              subtitle={`${net30?.orders.length || 0} open orders`}
              loading={loading}
            />
          </div>
        </FadeIn>

        {/* ================================================================
            PROGRESS SUMMARY BAR
        ================================================================ */}
        <FadeIn delay={160}>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Payment Status Distribution
            </p>
            <ProgressSummaryBar
              pastDue={net30?.summary.past_due || 0}
              dueSoon={net30?.summary.due_soon || 0}
              upcoming={net30?.summary.upcoming || 0}
            />
          </div>
        </FadeIn>

        {/* ================================================================
            NET30 PAYMENT TRACKING
        ================================================================ */}
        <FadeIn delay={240}>
          <SectionDivider label="Payment Tracking" icon={DollarSign} />
        </FadeIn>

        <FadeIn delay={300}>
          <ChartCard
            title="NET30 Payment Tracking"
            icon={DollarSign}
            iconColor="text-green-600"
            subtitle={`${net30?.orders.length || 0} orders across all statuses`}
            loading={loading}
            action={
              <span className="text-xs text-slate-400 font-medium">
                Total: {formatCurrency(totalNet30Value)}
              </span>
            }
          >
            <DataTable<Net30Order>
              columns={net30Columns}
              data={net30?.orders || []}
              loading={loading}
              emptyMessage="No NET30 orders found"
            />
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            FOLLOW-UP REPAIR ORDERS
        ================================================================ */}
        <FadeIn delay={380}>
          <SectionDivider label="Follow-Up Orders" icon={Wrench} />
        </FadeIn>

        <FadeIn delay={440}>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={FileText}
              label="Approved"
              value={followups?.statuses.Approved || 0}
              color="green"
              subtitle="Ready to process"
              loading={loading}
            />
            <StatCard
              icon={ShoppingCart}
              label="Delivered"
              value={followups?.statuses.Delivered || 0}
              color="purple"
              subtitle="Awaiting confirmation"
              loading={loading}
            />
          </div>
        </FadeIn>

        <FadeIn delay={500}>
          <ChartCard
            title="Follow-Up Repair Orders"
            icon={Wrench}
            iconColor="text-orange-600"
            subtitle={`${followups?.orders.length || 0} orders requiring attention`}
            loading={loading}
          >
            <DataTable<FollowupRO>
              columns={followupColumns}
              data={followups?.orders || []}
              loading={loading}
              emptyMessage="No follow-up repair orders"
            />
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            PURCHASE ORDERS
        ================================================================ */}
        <FadeIn delay={580}>
          <SectionDivider label="Purchase Orders" icon={ShoppingCart} />
        </FadeIn>

        <FadeIn delay={640}>
          <ChartCard
            title="Open Purchase Orders"
            icon={ShoppingCart}
            iconColor="text-purple-600"
            subtitle={`${data?.purchaseOrders?.length || 0} open orders`}
            loading={loading}
          >
            <DataTable<PurchaseOrder>
              columns={poColumns}
              data={data?.purchaseOrders || []}
              loading={loading}
              emptyMessage="No open purchase orders"
            />
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            ACTIVE REPAIR ORDERS
        ================================================================ */}
        <FadeIn delay={720}>
          <SectionDivider label="Repair Orders" icon={Wrench} />
        </FadeIn>

        <FadeIn delay={780}>
          <ChartCard
            title="Active Repair Orders"
            icon={Wrench}
            iconColor="text-orange-500"
            subtitle={`${data?.repairOrders?.length || 0} active orders`}
            loading={loading}
          >
            <DataTable<RepairOrderERP>
              columns={roColumns}
              data={data?.repairOrders || []}
              loading={loading}
              emptyMessage="No active repair orders"
            />
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            AUTOMATION PREVIEW (DRY RUN)
        ================================================================ */}
        <FadeIn delay={860}>
          <SectionDivider label="Automation Tools" icon={Zap} />
        </FadeIn>

        <FadeIn delay={920}>
          <ChartCard
            title="Automation Preview (Dry Run)"
            icon={Zap}
            iconColor="text-yellow-500"
            subtitle="Test automation outputs before triggering real actions"
            action={
              <button
                onClick={() => setPreviewOpen(!previewOpen)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
              >
                {previewOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {previewOpen ? 'Collapse' : 'Expand'}
              </button>
            }
          >
            {previewOpen ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => runPreview('net30')}
                    disabled={previewLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    Preview NET30 Reminders
                  </button>
                  <button
                    onClick={() => runPreview('digest')}
                    disabled={previewLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    Preview RO Digest
                  </button>
                </div>

                {previewLoading && (
                  <div className="flex items-center gap-3 text-slate-500 text-sm py-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full border-2 border-slate-200" />
                      <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin" />
                    </div>
                    Running <span className="font-semibold text-slate-700">{previewType}</span> preview...
                  </div>
                )}

                {previewResult && !previewLoading && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Preview Output &mdash; {previewType}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        JSON
                      </span>
                    </div>
                    <JsonHighlighted data={previewResult} />
                  </div>
                )}

                {!previewResult && !previewLoading && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    <Zap className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    Select a preview type above to see automation output
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-slate-400">
                Click <span className="font-medium text-slate-600">Expand</span> to access dry-run automation previews
              </div>
            )}
          </ChartCard>
        </FadeIn>
      </div>
    </>
  )
}
