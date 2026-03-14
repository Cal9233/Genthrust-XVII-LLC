'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, AlertCircle, BarChart3, Package, Search,
  AlertTriangle, TrendingUp, Clock, PieChart as PieChartIcon,
  FileText
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'
import { PdfDropZone } from '@/components/internal/PdfDropZone'
import { PdfReviewTable } from '@/components/internal/PdfReviewTable'
import { InventoryMatchResults } from '@/components/internal/InventoryMatchResults'
import type { ParsedPdfRow, ParsePdfResponse, BatchSearchResponse } from '@/types/pdf'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryData {
  pendingDrafts: number
  committedStock: number
  totalSkus: number
  todayAlerts: number
}

interface ConditionItem {
  condition: string
  count: number
  qty: number
}

interface VelocityItem {
  part_number: string
  sold_last_7d: number
  sold_last_30d: number
  sold_last_90d: number
  total_revenue_30d: number
  velocity_tier: string
}

interface AlertItem {
  id: number
  alert_type: string
  part_number: string
  serial_number: string | null
  details: string
  created_at: string
}

interface DashboardData {
  summary: SummaryData
  conditionBreakdown: ConditionItem[]
  salesVelocity: VelocityItem[]
  alerts: AlertItem[]
  syncStatus: { lastSync: string; isStale: boolean }
}

interface SearchResult {
  part_number: string
  description: string | null
  condition: string | null
  quantity: number
  warehouse_code: string | null
  unit_price: number | null
  serial_number: string | null
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
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Condition colors (shared between pill, pie chart, and search badge)
// ---------------------------------------------------------------------------

const CONDITION_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  NE: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', hex: '#22c55e' },
  OH: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', hex: '#3b82f6' },
  SV: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', hex: '#a855f7' },
  AR: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', hex: '#f97316' },
  FN: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', hex: '#14b8a6' },
  RP: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', hex: '#ec4899' },
  NS: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', hex: '#eab308' },
}
const DEFAULT_CONDITION = { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', hex: '#94a3b8' }

function conditionColor(cond: string) {
  return CONDITION_COLORS[cond] || DEFAULT_CONDITION
}

// Palette for extra slices beyond the named ones
const PIE_FALLBACK_COLORS = ['#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9']

// ---------------------------------------------------------------------------
// Sub-components: badges & pills
// ---------------------------------------------------------------------------

function VelocityBadge({ tier }: { tier: string }) {
  if (tier === 'HIGH')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">HIGH</span>
  if (tier === 'MEDIUM')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">MEDIUM</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{tier || 'LOW'}</span>
}

function AlertTypeBadge({ type }: { type: string }) {
  const t = type?.toLowerCase() || ''
  if (t.includes('low') || t.includes('stock'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">Low Stock</span>
  if (t.includes('deplet'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Depleted</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{type}</span>
}

function ConditionPill({ condition, count }: { condition: string; count: number }) {
  const c = conditionColor(condition)
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {condition || 'N/A'}: {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Staggered fade-in wrapper
// ---------------------------------------------------------------------------

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className}`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom pie chart tooltip
// ---------------------------------------------------------------------------

function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-900">{d.name}</p>
      <p className="text-slate-500">{d.value} SKUs</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom bar chart tooltip
// ---------------------------------------------------------------------------

function BarTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-slate-700">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const velocityColumns = [
  { key: 'part_number', label: 'Part Number', sortable: true, render: (row: VelocityItem) => <span className="font-medium text-slate-900">{row.part_number}</span> },
  { key: 'sold_last_7d', label: '7d Sold', align: 'right' as const, sortable: true },
  { key: 'sold_last_30d', label: '30d Sold', align: 'right' as const, sortable: true },
  { key: 'sold_last_90d', label: '90d Sold', align: 'right' as const, sortable: true },
  { key: 'total_revenue_30d', label: '30d Revenue', align: 'right' as const, sortable: true, render: (row: VelocityItem) => <span className="font-medium">{formatCurrency(row.total_revenue_30d)}</span> },
  { key: 'velocity_tier', label: 'Tier', sortable: true, render: (row: VelocityItem) => <VelocityBadge tier={row.velocity_tier} /> },
]

const alertColumns = [
  { key: 'alert_type', label: 'Type', sortable: true, render: (row: AlertItem) => <AlertTypeBadge type={row.alert_type} /> },
  { key: 'part_number', label: 'Part Number', sortable: true, render: (row: AlertItem) => <span className="font-medium text-slate-900">{row.part_number}</span> },
  { key: 'serial_number', label: 'Serial', sortable: true, render: (row: AlertItem) => <span className="text-slate-600">{row.serial_number || '—'}</span> },
  { key: 'details', label: 'Details', render: (row: AlertItem) => <span className="text-slate-600 truncate block max-w-[300px]">{row.details}</span> },
  { key: 'created_at', label: 'Time', sortable: true, render: (row: AlertItem) => <span className="text-slate-500 text-xs">{formatDate(row.created_at)}</span> },
]

const searchColumns = [
  { key: 'part_number', label: 'Part Number', sortable: true, render: (row: SearchResult) => <span className="font-medium text-slate-900">{row.part_number}</span> },
  { key: 'description', label: 'Description', render: (row: SearchResult) => <span className="text-slate-600 truncate block max-w-[200px]">{row.description || '—'}</span> },
  { key: 'condition', label: 'Condition', sortable: true, render: (row: SearchResult) => <ConditionPill condition={row.condition || ''} count={row.quantity} /> },
  { key: 'quantity', label: 'Qty', align: 'right' as const, sortable: true },
  { key: 'warehouse_code', label: 'Warehouse', sortable: true, render: (row: SearchResult) => <span className="text-slate-600">{row.warehouse_code || '—'}</span> },
  { key: 'unit_price', label: 'Unit Price', align: 'right' as const, sortable: true, render: (row: SearchResult) => <span className="font-medium">{formatCurrency(row.unit_price)}</span> },
]

// ===========================================================================
// Page Component
// ===========================================================================

export default function InventoryIntelligencePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCondition, setSearchCondition] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // C Check PDF state
  const [pdfRows, setPdfRows] = useState<ParsedPdfRow[] | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchSearchResponse | null>(null)
  const [batchSearchLoading, setBatchSearchLoading] = useState(false)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/inventory-intelligence')
      if (!res.ok) throw new Error('Failed to load inventory intelligence')
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const performSearch = useCallback(async (q: string, cond: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ q })
      if (cond) params.set('condition', cond)
      const res = await fetch(`/api/internal/inventory-intelligence/search?${params}`)
      if (res.ok) {
        const json = await res.json()
        setSearchResults(json.results || [])
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handlePdfParsed = useCallback((response: ParsePdfResponse) => {
    setPdfRows(response.rows)
    setPdfFileName(response.fileName)
    setPdfPageCount(response.pageCount)
    setBatchResults(null)
  }, [])

  const handleBatchSearch = useCallback(async (selectedRows: ParsedPdfRow[]) => {
    setBatchSearchLoading(true)
    try {
      const partNumbers = selectedRows.map(r => r.partNumber)
      const includeAlts: Record<string, string[]> = {}
      for (const row of selectedRows) {
        if (row.altPartNumbers.length > 0) {
          includeAlts[row.partNumber] = row.altPartNumbers
        }
      }

      const res = await fetch('/api/internal/inventory-intelligence/batch-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumbers, includeAlts }),
      })

      if (res.ok) {
        const data: BatchSearchResponse = await res.json()
        setBatchResults(data)
      }
    } catch {
      // Batch search failed silently
    } finally {
      setBatchSearchLoading(false)
    }
  }, [])

  const resetCCheckState = useCallback(() => {
    setPdfRows(null)
    setPdfFileName(null)
    setPdfPageCount(0)
    setBatchResults(null)
    setBatchSearchLoading(false)
  }, [])

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const timeout = setTimeout(() => performSearch(searchQuery, searchCondition), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchCondition, performSearch])

  // -------------------------------------------------------------------------
  // Derived chart data
  // -------------------------------------------------------------------------

  const pieData = useMemo(() => {
    if (!data?.conditionBreakdown) return []
    return data.conditionBreakdown.map((c) => ({
      name: c.condition || 'N/A',
      value: c.count,
    }))
  }, [data?.conditionBreakdown])

  const pieColors = useMemo(() => {
    if (!data?.conditionBreakdown) return []
    let fallbackIdx = 0
    return data.conditionBreakdown.map((c) => {
      const known = CONDITION_COLORS[c.condition]
      if (known) return known.hex
      const fb = PIE_FALLBACK_COLORS[fallbackIdx % PIE_FALLBACK_COLORS.length]
      fallbackIdx++
      return fb
    })
  }, [data?.conditionBreakdown])

  const barData = useMemo(() => {
    if (!data?.salesVelocity) return []
    return data.salesVelocity
      .slice(0, 10)
      .map((v) => ({
        part: v.part_number.length > 14 ? v.part_number.slice(0, 12) + '...' : v.part_number,
        '7d': v.sold_last_7d,
        '30d': v.sold_last_30d,
        '90d': v.sold_last_90d,
      }))
  }, [data?.salesVelocity])

  // -------------------------------------------------------------------------
  // Loading state (full-page skeleton)
  // -------------------------------------------------------------------------

  if (loading && !data) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded mt-2 animate-pulse" />
          </div>
          <div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        {/* Stat card skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCard key={i} icon={Package} label="" value="" color="slate" loading />
          ))}
        </div>
        {/* Chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="" loading />
          <ChartCard title="" loading />
        </div>
        {/* Table skeleton */}
        <DataTable columns={velocityColumns} data={[]} loading />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const summary = data?.summary
  const syncAge = data?.syncStatus?.lastSync && data.syncStatus.lastSync !== 'Unknown'
    ? new Date(data.syncStatus.lastSync).toLocaleString()
    : 'Unknown'

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Inventory & Sales Intelligence</h1>
            <p className="text-slate-500 mt-1 text-sm">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </FadeIn>

      {/* ── Summary Stat Cards ──────────────────────────────────────────── */}
      <FadeIn delay={80}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Package} label="Pending Drafts" value={summary?.pendingDrafts ?? 0} color="purple" />
          <StatCard icon={BarChart3} label="Committed Stock" value={summary?.committedStock ?? 0} color="green" />
          <StatCard icon={Package} label="Total SKUs" value={summary?.totalSkus ?? 0} color="blue" />
          <StatCard icon={AlertTriangle} label="Today's Alerts" value={summary?.todayAlerts ?? 0} color="yellow" />
          <StatCard
            icon={Clock}
            label="Sync Status"
            value={data?.syncStatus?.isStale ? 'STALE' : 'OK'}
            color={data?.syncStatus?.isStale ? 'red' : 'green'}
            subtitle={syncAge}
          />
          <StatCard icon={TrendingUp} label="Velocity Items" value={data?.salesVelocity?.length ?? 0} color="teal" />
        </div>
      </FadeIn>

      {/* ── Condition Breakdown: pills + donut chart ────────────────────── */}
      <FadeIn delay={160}>
        <SectionDivider label="Condition Breakdown" icon={PieChartIcon} />
      </FadeIn>

      <FadeIn delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pills card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-slate-500 mb-3">By Condition Code</h3>
            <div className="flex flex-wrap gap-2">
              {data?.conditionBreakdown.map((c) => (
                <ConditionPill key={c.condition} condition={c.condition} count={c.count} />
              ))}
              {(!data?.conditionBreakdown || data.conditionBreakdown.length === 0) && (
                <p className="text-sm text-slate-400">No condition data available</p>
              )}
            </div>
          </div>

          {/* Donut chart */}
          <ChartCard title="SKU Distribution" icon={PieChartIcon} iconColor="text-purple-500">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={pieColors[idx]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PieTooltipContent />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-10">No condition data available</p>
            )}
          </ChartCard>
        </div>
      </FadeIn>

      {/* ── Sales Velocity: bar chart + table ───────────────────────────── */}
      <FadeIn delay={280}>
        <SectionDivider label="Sales Velocity" icon={TrendingUp} />
      </FadeIn>

      <FadeIn delay={320}>
        <ChartCard
          title="Top 10 Movers — Units Sold"
          icon={BarChart3}
          iconColor="text-teal-500"
          subtitle="Grouped by 7-day, 30-day, and 90-day windows"
        >
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <XAxis
                  dataKey="part"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <RechartsTooltip content={<BarTooltipContent />} />
                <Bar dataKey="7d" name="7-day" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="30d" name="30-day" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="90d" name="90-day" fill="#14b8a6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No velocity data available</p>
          )}
        </ChartCard>
      </FadeIn>

      <FadeIn delay={400}>
        <ChartCard title="Sales Velocity — Top Movers" icon={TrendingUp} iconColor="text-teal-500">
          <DataTable<VelocityItem>
            columns={velocityColumns}
            data={data?.salesVelocity ?? []}
            emptyMessage="No velocity data available"
            loading={loading && !data}
          />
        </ChartCard>
      </FadeIn>

      {/* ── Recent Alerts ───────────────────────────────────────────────── */}
      <FadeIn delay={480}>
        <SectionDivider label="Alerts" icon={AlertTriangle} />
      </FadeIn>

      <FadeIn delay={520}>
        <ChartCard title="Recent Alerts" icon={AlertTriangle} iconColor="text-yellow-500">
          <DataTable<AlertItem>
            columns={alertColumns}
            data={data?.alerts ?? []}
            emptyMessage="No recent alerts"
            loading={loading && !data}
          />
        </ChartCard>
      </FadeIn>

      {/* ── C Check Part Lookup ──────────────────────────────────────── */}
      <FadeIn delay={560}>
        <SectionDivider label="C Check Part Lookup" icon={FileText} />
      </FadeIn>

      <FadeIn delay={600}>
        <ChartCard
          title="C Check Part Lookup"
          icon={FileText}
          iconColor="text-indigo-500"
          subtitle="Upload a C Check pre-draw PDF to bulk-check part availability"
        >
          {batchSearchLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-600">Searching inventory...</p>
              <p className="text-xs text-slate-400 mt-1">Checking local database and ERP AERO</p>
            </div>
          ) : batchResults ? (
            <InventoryMatchResults results={batchResults} onReset={resetCCheckState} />
          ) : pdfRows ? (
            <PdfReviewTable
              rows={pdfRows}
              fileName={pdfFileName || ''}
              pageCount={pdfPageCount}
              onSearch={handleBatchSearch}
              onReset={resetCCheckState}
            />
          ) : (
            <PdfDropZone onParsed={handlePdfParsed} />
          )}
        </ChartCard>
      </FadeIn>

      {/* ── Inventory Search ────────────────────────────────────────────── */}
      <FadeIn delay={680}>
        <SectionDivider label="Inventory Search" icon={Search} />
      </FadeIn>

      <FadeIn delay={720}>
        <ChartCard title="Inventory Search" icon={Search} iconColor="text-blue-500">
          {/* Search inputs */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by part number..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={searchCondition}
              onChange={(e) => setSearchCondition(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Conditions</option>
              <option value="NE">NE — New</option>
              <option value="OH">OH — Overhauled</option>
              <option value="SV">SV — Serviceable</option>
              <option value="AR">AR — As Removed</option>
            </select>
          </div>

          {/* Search results */}
          {searchLoading && (
            <DataTable columns={searchColumns} data={[]} loading />
          )}

          {!searchLoading && searchResults.length > 0 && (
            <>
              <DataTable<SearchResult>
                columns={searchColumns}
                data={searchResults}
                emptyMessage="No results"
              />
              <p className="text-xs text-slate-400 mt-2">{searchResults.length} results</p>
            </>
          )}

          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No results found for &ldquo;{searchQuery}&rdquo;</div>
          )}
        </ChartCard>
      </FadeIn>
    </div>
  )
}
