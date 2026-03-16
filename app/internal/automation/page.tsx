'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  RefreshCw, AlertCircle, Zap, DollarSign, FileText,
  Wrench, ShoppingCart, ChevronDown, ChevronRight, Play,
  Clock, CalendarClock, Timer, TrendingUp,
  Mail, Send, MessageSquare, Database, CheckCircle2, XCircle,
  Loader2, ExternalLink, Search
} from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable, StatusBadge } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'

// ---------------------------------------------------------------------------
// Types — from @genthrust/shared via types/automation
// ---------------------------------------------------------------------------

import type {
  Net30Order,
  FollowupRO,
  PurchaseOrder,
  RepairOrderERP,
  AutomationDashboardData,
} from '@/types/automation'

type AutomationData = AutomationDashboardData

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
      ? 'bg-[#f85149]'
      : order.status_flag === 'DUE_SOON'
        ? 'bg-[#d29922]'
        : 'bg-[#1f6feb]'

  const bgTrack =
    order.status_flag === 'PAST_DUE'
      ? 'bg-[#f85149]/20'
      : order.status_flag === 'DUE_SOON'
        ? 'bg-[#d29922]/20'
        : 'bg-[#1f6feb]/20'

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className={`relative flex-1 h-2 rounded-full ${bgTrack} overflow-hidden`}>
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
        {overflow > 0 && (
          <div
            className="absolute top-0 h-full bg-[#f85149]/60 rounded-r-full"
            style={{ left: '100%', width: `${overflow}%`, marginLeft: '-1px' }}
          />
        )}
      </div>
      <span className="text-[10px] font-mono text-[#484f58] w-8 text-right shrink-0">
        {order.days_overdue !== undefined
          ? <span className="text-[#f85149]">+{order.days_overdue}</span>
          : order.days_until_due !== undefined
            ? <span className={order.days_until_due <= 7 ? 'text-[#d29922]' : 'text-[#484f58]'}>{order.days_until_due}d</span>
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
    { count: pastDue, color: 'bg-[#f85149]', label: 'Past Due', textColor: 'text-[#f85149]', dotColor: 'bg-[#f85149]' },
    { count: dueSoon, color: 'bg-[#d29922]', label: 'Due Soon', textColor: 'text-[#d29922]', dotColor: 'bg-[#d29922]' },
    { count: upcoming, color: 'bg-[#1f6feb]', label: 'Upcoming', textColor: 'text-[#58a6ff]', dotColor: 'bg-[#1f6feb]' },
  ]

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden flex">
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
            <span className="text-[#8b949e]">{seg.label}</span>
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
          <span className="text-[#484f58]">{colon}</span>
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
      return <>{ws}<span className="text-green-400">&quot;{val}&quot;</span><span className="text-[#484f58]">{trail}</span></>
    }
    // number value
    const numMatch = fragment.match(/^(\s*)(-?\d+\.?\d*)(,?)(.*)$/)
    if (numMatch) {
      const [, ws, num, comma, rest] = numMatch
      return <>{ws}<span className="text-amber-400">{num}</span><span className="text-[#484f58]">{comma}</span>{rest}</>
    }
    // boolean / null
    const boolMatch = fragment.match(/^(\s*)(true|false|null)(,?)(.*)$/)
    if (boolMatch) {
      const [, ws, val, comma, rest] = boolMatch
      return <>{ws}<span className="text-cyan-400">{val}</span><span className="text-[#484f58]">{comma}</span>{rest}</>
    }
    return <span className="text-[#8b949e]">{fragment}</span>
  }

  return (
    <div className="bg-[#0b0f14] rounded-lg p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
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
        <div key={i} className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
            <div className="flex-1">
              <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
              <div className="h-6 w-20 bg-white/[0.06] rounded" />
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

// ---------------------------------------------------------------------------
// Email Tools types
// ---------------------------------------------------------------------------

interface EmailDraftResult {
  success: boolean
  messageId?: string
  webLink?: string
  error?: string
}

interface ThreadMessage {
  id: string
  subject?: string
  from?: { emailAddress?: { name?: string; address?: string } }
  receivedDateTime?: string
  bodyPreview?: string
  body?: { content?: string; contentType?: string }
}

interface SyncResult {
  success?: boolean
  message?: string
  count?: number
  mode?: string
  error?: string
}

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

  // Email draft state
  const [draftTo, setDraftTo] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftResult, setDraftResult] = useState<EmailDraftResult | null>(null)

  // Thread viewer state
  const [threadConversationId, setThreadConversationId] = useState('')
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[] | null>(null)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [threadExpanded, setThreadExpanded] = useState<string | null>(null)

  // Sync state
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncLastAt, setSyncLastAt] = useState<Date | null>(null)
  const [syncFullMode, setSyncFullMode] = useState(false)

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

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault()
    setDraftLoading(true)
    setDraftResult(null)
    try {
      const res = await fetch('/api/internal/email/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: draftTo, subject: draftSubject, body: draftBody }),
      })
      const json = await res.json()
      setDraftResult(json)
      if (json.success) {
        setDraftTo('')
        setDraftSubject('')
        setDraftBody('')
      }
    } catch {
      setDraftResult({ success: false, error: 'Request failed' })
    } finally {
      setDraftLoading(false)
    }
  }

  async function fetchThread(e: React.FormEvent) {
    e.preventDefault()
    if (!threadConversationId.trim()) return
    setThreadLoading(true)
    setThreadMessages(null)
    setThreadError(null)
    setThreadExpanded(null)
    try {
      const res = await fetch(`/api/internal/email/thread?conversationId=${encodeURIComponent(threadConversationId.trim())}`)
      const json = await res.json()
      if (json.graphError || json.error) {
        setThreadError(json.error || 'Failed to fetch thread')
      } else {
        setThreadMessages(json.messages || [])
      }
    } catch {
      setThreadError('Request failed')
    } finally {
      setThreadLoading(false)
    }
  }

  async function triggerSync() {
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const url = `/api/internal/sync/parts${syncFullMode ? '?full=true' : ''}`
      const res = await fetch(url, { method: 'POST' })
      const json = await res.json()
      setSyncResult(json)
      if (json.success) setSyncLastAt(new Date())
    } catch {
      setSyncResult({ error: 'Sync request failed' })
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // -- Column definitions --------------------------------------------------

  const net30Columns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: Net30Order) => <span className="font-semibold text-[#f0f6fc]">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: Net30Order) => <span className="text-[#8b949e] truncate block max-w-[180px]">{r.vendor}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: Net30Order) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(r.total)}</span> },
    { key: 'payment_terms', label: 'Terms', sortable: true },
    { key: 'received_date', label: 'Received', sortable: true, render: (r: Net30Order) => <span className="text-[#8b949e]">{formatDate(r.received_date)}</span> },
    { key: 'payment_due_date', label: 'Due Date', sortable: true, render: (r: Net30Order) => <span className="text-[#8b949e]">{formatDate(r.payment_due_date)}</span> },
    { key: 'status_flag', label: 'Status', sortable: true, render: (r: Net30Order) => <StatusBadge status={r.status_flag} /> },
    { key: 'timeline', label: 'Timeline', render: (r: Net30Order) => <PaymentTimelineBar order={r} /> },
  ], [])

  const followupColumns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: FollowupRO) => <span className="font-semibold text-[#f0f6fc]">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: FollowupRO) => <span className="text-[#8b949e] truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: FollowupRO) => <StatusBadge status={r.status} /> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: FollowupRO) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(r.total)}</span> },
    { key: 'payment_terms', label: 'Terms', sortable: true, render: (r: FollowupRO) => <span className="text-[#8b949e]">{r.payment_terms || '\u2014'}</span> },
  ], [])

  const poColumns = useMemo(() => [
    { key: 'po_number', label: 'PO #', sortable: true, render: (r: PurchaseOrder) => <span className="font-semibold text-[#f0f6fc]">{r.po_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: PurchaseOrder) => <span className="text-[#8b949e] truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'po_date', label: 'Date', sortable: true, render: (r: PurchaseOrder) => <span className="text-[#8b949e]">{formatDate(r.po_date)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: PurchaseOrder) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(r.total)}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: PurchaseOrder) => <StatusBadge status={r.status} /> },
    { key: 'payment_terms', label: 'Terms', sortable: true, render: (r: PurchaseOrder) => <span className="text-[#8b949e]">{r.payment_terms || '\u2014'}</span> },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (r: PurchaseOrder) => <span className="text-[#8b949e]">{formatDate(r.due_date)}</span> },
  ], [])

  const roColumns = useMemo(() => [
    { key: 'ro_number', label: 'RO #', sortable: true, render: (r: RepairOrderERP) => <span className="font-semibold text-[#f0f6fc]">{r.ro_number}</span> },
    { key: 'vendor', label: 'Vendor', sortable: true, render: (r: RepairOrderERP) => <span className="text-[#8b949e] truncate block max-w-[200px]">{r.vendor}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (r: RepairOrderERP) => <StatusBadge status={r.status} /> },
    { key: 'due_date', label: 'Due Date', sortable: true, render: (r: RepairOrderERP) => <span className="text-[#8b949e]">{formatDate(r.due_date)}</span> },
    { key: 'total', label: 'Total', align: 'right' as const, sortable: true, render: (r: RepairOrderERP) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(r.total)}</span> },
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
            <div className="h-8 w-72 bg-white/[0.06] rounded mb-2" />
            <div className="h-4 w-48 bg-white/[0.04] rounded" />
          </div>
          <div className="h-10 w-10 bg-white/[0.06] rounded-lg" />
        </div>

        <StatCardSkeletonRow count={4} />

        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="h-5 w-52 bg-white/[0.06] rounded" />
          </div>
          <div className="p-5 space-y-3">
            <div className="h-3 w-full bg-white/[0.04] rounded" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-6">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <div key={j} className="h-4 bg-white/[0.04] rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <StatCardSkeletonRow count={2} />

        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="h-5 w-44 bg-white/[0.06] rounded" />
          </div>
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-6">
                {[1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="h-4 bg-white/[0.04] rounded flex-1" />
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
          <div className="w-16 h-16 rounded-full bg-[#f85149]/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#f85149]" />
          </div>
          <p className="text-[#f85149] font-semibold text-lg mb-1">Failed to Load Data</p>
          <p className="text-sm text-[#8b949e] mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#f85149]/80 hover:bg-[#f85149] rounded-lg border border-[#f85149]/40 transition-colors"
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
    <div className="space-y-8" style={{ animation: 'fadeInUp 0.2s ease-out both' }}>
        {/* ================================================================
            HEADER
        ================================================================ */}
        <FadeIn delay={0}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#f0f6fc] tracking-tight">
                ERP Automation Dashboard
              </h1>
              <p className="text-[#484f58] mt-1 text-xs font-mono tabular-nums flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              aria-label="Refresh automation data"
              className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
          <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">
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
              <span className="text-xs text-[#484f58] font-medium">
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
                className="text-xs font-medium text-[#484f58] hover:text-[#8b949e] transition-colors flex items-center gap-1"
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-lg transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Preview NET30 Reminders
                  </button>
                  <button
                    onClick={() => runPreview('digest')}
                    disabled={previewLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#a371f7]/80 hover:bg-[#a371f7] rounded-lg transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Preview RO Digest
                  </button>
                </div>

                {previewLoading && (
                  <div className="flex items-center gap-3 text-[#8b949e] text-sm py-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full border-2 border-white/[0.08]" />
                      <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-t-[#58a6ff] animate-spin" />
                    </div>
                    Running <span className="font-semibold text-[#f0f6fc]">{previewType}</span> preview...
                  </div>
                )}

                {previewResult && !previewLoading && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                        Preview Output &mdash; {previewType}
                      </span>
                      <span className="text-[10px] font-mono text-[#484f58] bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded">
                        JSON
                      </span>
                    </div>
                    <JsonHighlighted data={previewResult} />
                  </div>
                )}

                {!previewResult && !previewLoading && (
                  <div className="text-center py-8 text-[#484f58] text-sm">
                    <Zap className="w-6 h-6 mx-auto mb-2 text-[#484f58]" />
                    Select a preview type above to see automation output
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-[#484f58]">
                Click <span className="font-medium text-[#8b949e]">Expand</span> to access dry-run automation previews
              </div>
            )}
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            EMAIL TOOLS
        ================================================================ */}
        <FadeIn delay={1000}>
          <SectionDivider label="Email Tools" icon={Mail} />
        </FadeIn>

        {/* Draft Composer */}
        <FadeIn delay={1060}>
          <ChartCard
            title="Draft Email Composer"
            icon={Mail}
            iconColor="text-[#4a6fa5]"
            subtitle="Create a draft in the shared Outlook mailbox via Microsoft Graph"
          >
            <form onSubmit={submitDraft} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">To</label>
                  <input
                    type="email"
                    value={draftTo}
                    onChange={e => setDraftTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 text-sm border border-white/[0.08] rounded-lg bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#1f6feb] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={draftSubject}
                    onChange={e => setDraftSubject(e.target.value)}
                    required
                    maxLength={500}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 text-sm border border-white/[0.08] rounded-lg bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#1f6feb] transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Body</label>
                <textarea
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  required
                  rows={5}
                  maxLength={50000}
                  placeholder="Email body (HTML supported)"
                  className="w-full px-3 py-2 text-sm border border-white/[0.08] rounded-lg bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#1f6feb] transition-all resize-y font-mono"
                />
                <p className="text-[10px] text-[#484f58]">{draftBody.length.toLocaleString()} / 50,000 chars</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={draftLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-lg transition-all disabled:opacity-50"
                >
                  {draftLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {draftLoading ? 'Creating Draft...' : 'Save as Draft'}
                </button>
                {draftResult && (
                  <div className={`flex items-center gap-2 text-sm ${draftResult.success ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                    {draftResult.success
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <XCircle className="w-4 h-4 shrink-0" />}
                    {draftResult.success
                      ? <>Draft saved
                          {draftResult.webLink && (
                            <a
                              href={draftResult.webLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1.5 inline-flex items-center gap-1 underline underline-offset-2 hover:text-[#39d353]"
                            >
                              Open in Outlook <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      : draftResult.error || 'Failed to create draft'}
                  </div>
                )}
              </div>
            </form>
          </ChartCard>
        </FadeIn>

        {/* Thread Viewer */}
        <FadeIn delay={1120}>
          <ChartCard
            title="Email Thread Viewer"
            icon={MessageSquare}
            iconColor="text-[#8b2040]"
            subtitle="Fetch a conversation thread by ID from the shared mailbox"
          >
            <form onSubmit={fetchThread} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Conversation ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={threadConversationId}
                    onChange={e => setThreadConversationId(e.target.value)}
                    required
                    placeholder="AAQkAG1mNTQwNjU1..."
                    className="flex-1 px-3 py-2 text-sm border border-white/[0.08] rounded-lg bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] focus:outline-none focus:border-[#1f6feb] transition-all font-mono"
                  />
                  <button
                    type="submit"
                    disabled={threadLoading || !threadConversationId.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#9c2a3e]/80 hover:bg-[#9c2a3e] rounded-lg transition-all disabled:opacity-50 whitespace-nowrap border border-[#9c2a3e]/40"
                  >
                    {threadLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Search className="w-4 h-4" />}
                    {threadLoading ? 'Loading...' : 'Fetch Thread'}
                  </button>
                </div>
              </div>

              {threadError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#f85149]/10 border border-[#f85149]/20 rounded-lg text-sm text-[#f85149]">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {threadError}
                </div>
              )}

              {threadMessages !== null && !threadLoading && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
                    {threadMessages.length === 0 ? 'No messages found' : `${threadMessages.length} message${threadMessages.length !== 1 ? 's' : ''}`}
                  </p>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
                    {threadMessages.map(msg => (
                      <div
                        key={msg.id}
                        className="border border-white/[0.06] rounded-lg overflow-hidden bg-white/[0.03] hover:border-white/[0.12] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setThreadExpanded(prev => prev === msg.id ? null : msg.id)}
                          className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-[#f0f6fc] truncate">
                                {msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown sender'}
                              </span>
                              <span className="text-[10px] text-[#484f58] shrink-0">
                                {msg.receivedDateTime
                                  ? new Date(msg.receivedDateTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                            <p className="text-xs text-[#8b949e] font-medium truncate">{msg.subject || '(no subject)'}</p>
                            {threadExpanded !== msg.id && (
                              <p className="text-xs text-[#484f58] mt-0.5 line-clamp-1">{msg.bodyPreview}</p>
                            )}
                          </div>
                          {threadExpanded === msg.id
                            ? <ChevronDown className="w-4 h-4 text-[#484f58] shrink-0 mt-0.5" />
                            : <ChevronRight className="w-4 h-4 text-[#484f58] shrink-0 mt-0.5" />}
                        </button>
                        {threadExpanded === msg.id && (
                          <div className="px-4 pb-4 border-t border-white/[0.04]">
                            <pre className="text-xs text-[#8b949e] leading-relaxed whitespace-pre-wrap mt-3 font-sans">
                              {msg.bodyPreview || '(no preview available)'}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </ChartCard>
        </FadeIn>

        {/* ================================================================
            ERP SYNC TRIGGER
        ================================================================ */}
        <FadeIn delay={1200}>
          <SectionDivider label="ERP Sync" icon={Database} />
        </FadeIn>

        <FadeIn delay={1260}>
          <ChartCard
            title="Parts Sync Trigger"
            icon={Database}
            iconColor="text-[#4a6fa5]"
            subtitle="Trigger an ERP parts sync — incremental (recent changes) or full catalog"
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="relative inline-block w-10 h-5">
                    <input
                      type="checkbox"
                      checked={syncFullMode}
                      onChange={e => setSyncFullMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="absolute inset-0 bg-white/[0.08] rounded-full peer-checked:bg-[#1f6feb] transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                  </span>
                  <span className="text-sm font-medium text-[#f0f6fc]">
                    Full sync <span className="text-xs font-normal text-[#484f58]">(vs incremental)</span>
                  </span>
                </label>

                <button
                  onClick={triggerSync}
                  disabled={syncLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-lg transition-all disabled:opacity-50 disabled:bg-white/[0.06]"
                >
                  {syncLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Database className="w-4 h-4" />}
                  {syncLoading ? 'Syncing...' : `Run ${syncFullMode ? 'Full' : 'Incremental'} Sync`}
                </button>

                {syncLastAt && (
                  <span className="text-xs text-[#484f58] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Last sync: {syncLastAt.toLocaleTimeString()}
                  </span>
                )}
              </div>

              {syncLoading && (
                <div className="flex items-center gap-3 px-4 py-4 bg-[#1f6feb]/[0.08] border border-[#1f6feb]/20 rounded-lg">
                  <Loader2 className="w-5 h-5 text-[#58a6ff] animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#f0f6fc]">Sync in progress</p>
                    <p className="text-xs text-[#8b949e] mt-0.5">
                      Running {syncFullMode ? 'full' : 'incremental'} parts sync against ERP...
                    </p>
                  </div>
                </div>
              )}

              {syncResult && !syncLoading && (
                <div className={`flex items-start gap-3 px-4 py-4 rounded-lg border ${
                  syncResult.success
                    ? 'bg-[#3fb950]/10 border-[#3fb950]/20'
                    : 'bg-[#f85149]/10 border-[#f85149]/20'
                }`}>
                  {syncResult.success
                    ? <CheckCircle2 className="w-5 h-5 text-[#3fb950] shrink-0 mt-0.5" />
                    : <XCircle className="w-5 h-5 text-[#f85149] shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${syncResult.success ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                      {syncResult.success ? 'Sync complete' : 'Sync failed'}
                    </p>
                    {syncResult.message && (
                      <p className="text-xs text-[#8b949e] mt-0.5">{syncResult.message}</p>
                    )}
                    {syncResult.count !== undefined && (
                      <p className="text-xs text-[#8b949e] mt-1">
                        <span className="font-semibold text-[#f0f6fc]">{syncResult.count.toLocaleString()}</span> parts updated
                        {syncResult.mode && <span className="ml-1.5 text-[#484f58]">({syncResult.mode} mode)</span>}
                      </p>
                    )}
                    {syncResult.error && (
                      <p className="text-xs text-[#f85149] mt-0.5">{syncResult.error}</p>
                    )}
                  </div>
                </div>
              )}

              {!syncResult && !syncLoading && (
                <div className="text-center py-6 text-[#484f58] text-sm">
                  <Database className="w-6 h-6 mx-auto mb-2 text-[#484f58]" />
                  No sync run yet this session
                </div>
              )}
            </div>
          </ChartCard>
        </FadeIn>
    </div>
  )
}
