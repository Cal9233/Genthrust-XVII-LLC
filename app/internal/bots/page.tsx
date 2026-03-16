'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RefreshCw, AlertCircle, Bot, Activity, MessageSquare,
  Terminal, RotateCcw, ChevronDown, Package, Layers, Cpu,
  BarChart3, Search, AlertTriangle, TrendingUp, Clock,
  PieChart as PieChartIcon, FileText, Plus, CheckCircle2,
  Bell, Shield, Eye, Trash2, CheckCircle,
  Mail, Download, Filter, Send, X, Inbox, MessageCircle,
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Recharts components are dynamically imported to exclude them from the initial
// JS bundle (~120 KB gzipped). ssr: false is required because Recharts relies
// on browser-only APIs (ResizeObserver, SVG layout).
const BotSparklineDynamic = dynamic(
  () => import('@/components/internal/charts/BotFleetCharts').then((m) => m.BotSparkline),
  {
    ssr: false,
    loading: () => <div className="w-[80px] h-[30px] bg-white/[0.04] rounded animate-pulse" />,
  }
)

const SkuPieChartDynamic = dynamic(
  () => import('@/components/internal/charts/BotMetricsCharts').then((m) => m.SkuPieChart),
  {
    ssr: false,
    loading: () => <div className="w-full h-[260px] bg-white/[0.04] rounded-lg animate-pulse" />,
  }
)

const VelocityBarChartDynamic = dynamic(
  () => import('@/components/internal/charts/BotMetricsCharts').then((m) => m.VelocityBarChart),
  {
    ssr: false,
    loading: () => <div className="w-full h-[320px] bg-white/[0.04] rounded-lg animate-pulse" />,
  }
)
import { StatCard, StatCardSkeleton } from '@/components/internal/StatCard'
import { StatusDot } from '@/components/internal/DataTable'
import { DataTable, StatusBadge } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'
import { PdfDropZone } from '@/components/internal/PdfDropZone'
import { PdfReviewTable } from '@/components/internal/PdfReviewTable'
import { InventoryMatchResults } from '@/components/internal/InventoryMatchResults'
import type { ParsedPdfRow, ParsePdfResponse, BatchSearchResponse } from '@/types/pdf'

// =============================================================================
// SHARED TYPES
// =============================================================================

// --- Fleet ---
interface BotStatus {
  key: string
  displayName: string
  serviceName: string
  status: 'RUNNING' | 'STOPPED' | 'UNKNOWN'
  description: string
}
interface NotificationItem {
  timestamp: string
  bot: string
  botDisplayName: string
  event: string
  severity: 'info' | 'warning' | 'success' | 'error'
}
interface BotDashboardData {
  statuses: BotStatus[]
  metrics: Record<string, Record<string, number>>
  notifications: NotificationItem[]
}
interface InventorySnapshot {
  pendingDrafts: number
  committedStock: number
  totalSkus: number
  conditionBreakdown: { condition: string; count: number; qty: number }[]
}

// --- Inventory Intel ---
interface InvSummaryData {
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
interface InvAlertItem {
  id: number
  alert_type: string
  part_number: string
  serial_number: string | null
  details: string
  created_at: string
}
interface InvDashboardData {
  summary: InvSummaryData
  conditionBreakdown: ConditionItem[]
  salesVelocity: VelocityItem[]
  alerts: InvAlertItem[]
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

// --- Alarms ---
interface AlarmSummary {
  watchedParts: number
  activeAlarms: number
  ohWatched: number
  arWatched: number
}
interface AlarmItem {
  id: number
  alert_type: string
  part_number: string
  details: string
  created_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  watch_description: string | null
}
interface WatchlistItem {
  id: number
  part_number: string
  condition_code: string
  description: string | null
  added_by: string
  last_known_qty: number
  last_checked_at: string | null
  created_at: string
}
interface AlarmDashboardData {
  summary: AlarmSummary
  recentAlarms: AlarmItem[]
  watchlist: WatchlistItem[]
}
interface ErpPart {
  part_number: string
  description: string
  condition: string
  quantity: number
  unit_price: number
  warehouse: string
  serial_number: string | null
}
interface CheckResult {
  checked: number
  alarms_triggered: number
  alarms: { part_number: string; condition_code: string; previous_qty: number; current_qty: number }[]
}

// --- Quotes ---
interface QuoteRequest {
  id: number
  email_id: string | null
  sender_email: string
  sender_name: string
  subject: string
  part_numbers: string[]
  status: 'pending' | 'processed' | 'responded'
  received_at: string
  processed_at: string | null
  created_at: string
  updated_at: string
}
interface QuoteResponse {
  id: number
  quote_id: number
  response_text: string
  part_number: string | null
  price_quoted: number | null
  availability: string | null
  sent_at: string
  sent_by: string
  created_at: string
}
interface QuoteStats {
  pending: number
  processed: number
  responded: number
}

// =============================================================================
// SHARED FORMAT HELPERS
// =============================================================================

function formatDate(val: string | null) {
  if (!val) return '\u2014'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(val: string | null) {
  if (!val) return '\u2014'
  return new Date(val).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// =============================================================================
// FETCH WITH TIMEOUT HELPER
// =============================================================================

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

// =============================================================================
// SHARED MICRO-COMPONENTS
// =============================================================================

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div
      className={`animate-[fadeSlideIn_0.45s_ease-out_both] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    success: 'bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20',
    warning: 'bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20',
    error: 'bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20',
    info: 'bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  )
}

function BotBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    ils: 'bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/20',
    internal: 'bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20',
    sync: 'bg-[#39d353]/10 text-[#39d353] border border-[#39d353]/20',
    aog: 'bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20',
    inventory: 'bg-[#ffa657]/10 text-[#ffa657] border border-[#ffa657]/20',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[name] || 'bg-white/[0.06] text-[#8b949e] border border-white/[0.08]'}`}>
      {name.toUpperCase()}
    </span>
  )
}

// Inventory Intel components
const CONDITION_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  NE: { bg: 'bg-[#3fb950]/10', text: 'text-[#3fb950]', border: 'border-[#3fb950]/20', hex: '#3fb950' },
  OH: { bg: 'bg-[#58a6ff]/10', text: 'text-[#58a6ff]', border: 'border-[#58a6ff]/20', hex: '#58a6ff' },
  SV: { bg: 'bg-[#a371f7]/10', text: 'text-[#a371f7]', border: 'border-[#a371f7]/20', hex: '#a371f7' },
  AR: { bg: 'bg-[#ffa657]/10', text: 'text-[#ffa657]', border: 'border-[#ffa657]/20', hex: '#ffa657' },
  FN: { bg: 'bg-[#39d353]/10', text: 'text-[#39d353]', border: 'border-[#39d353]/20', hex: '#39d353' },
  RP: { bg: 'bg-[#f778ba]/10', text: 'text-[#f778ba]', border: 'border-[#f778ba]/20', hex: '#f778ba' },
  NS: { bg: 'bg-[#d29922]/10', text: 'text-[#d29922]', border: 'border-[#d29922]/20', hex: '#d29922' },
}
const DEFAULT_CONDITION = { bg: 'bg-white/[0.06]', text: 'text-[#8b949e]', border: 'border-white/[0.08]', hex: '#8b949e' }
const PIE_FALLBACK_COLORS = ['#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16', '#d946ef', '#0ea5e9']

function conditionColor(cond: string) { return CONDITION_COLORS[cond] || DEFAULT_CONDITION }

function VelocityBadge({ tier }: { tier: string }) {
  if (tier === 'HIGH')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20">HIGH</span>
  if (tier === 'MEDIUM')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffa657]/10 text-[#ffa657] border border-[#ffa657]/20">MEDIUM</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.06] text-[#8b949e] border border-white/[0.08]">{tier || 'LOW'}</span>
}

function AlertTypeBadge({ type }: { type: string }) {
  const t = type?.toLowerCase() || ''
  if (t.includes('low') || t.includes('stock'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20">Low Stock</span>
  if (t.includes('deplet'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20">Depleted</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">{type}</span>
}

function ConditionPill({ condition, count }: { condition: string; count: number }) {
  const c = conditionColor(condition)
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {condition || 'N/A'}: {count}
    </span>
  )
}

// Alarms components
function ConditionBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NE: 'bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20',
    OH: 'bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20',
    SV: 'bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/20',
    AR: 'bg-[#ffa657]/10 text-[#ffa657] border border-[#ffa657]/20',
  }
  const c = colors[condition] || 'bg-white/[0.06] text-[#8b949e] border border-white/[0.08]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c}`}>
      {condition}
    </span>
  )
}

function AlarmTypeBadge({ type }: { type: string }) {
  const t = type?.toUpperCase() || ''
  if (t.includes('OH'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20">OH Depleted</span>
  if (t.includes('AR'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffa657]/10 text-[#ffa657] border border-[#ffa657]/20">AR Depleted</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20">{type}</span>
}

function QtyIndicator({ qty }: { qty: number }) {
  if (qty === 0) return <span className="inline-flex items-center gap-1 text-[#f85149] font-bold"><AlertTriangle className="w-3 h-3" /> 0</span>
  return <span className="text-[#3fb950] font-bold">{qty}</span>
}

// Fleet helpers
function generateSparkline(seed: string): { v: number }[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0 }
  return Array.from({ length: 12 }, (_, i) => {
    hash = ((hash << 5) - hash + i) | 0
    return { v: Math.abs(hash) % 10 }
  })
}

function highlightLogLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const timestampRe = /^(\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*\]?|\[\d{2}:\d{2}:\d{2}\])/
  const tsMatch = line.match(timestampRe)
  let rest = line
  if (tsMatch) {
    parts.push(<span key="ts" className="text-[#484f58]">{tsMatch[0]}</span>)
    rest = line.slice(tsMatch[0].length)
  }
  const keywordRe = /\b(ERROR|FATAL|EXCEPTION)\b/g
  const warnRe = /\b(WARNING|WARN)\b/g
  const successRe = /\b(SUCCESS|OK|COMPLETED)\b/g
  if (keywordRe.test(rest)) {
    parts.push(<span key="body" className="text-[#f85149]">{rest}</span>)
  } else if (warnRe.test(rest)) {
    parts.push(<span key="body" className="text-[#d29922]">{rest}</span>)
  } else if (successRe.test(rest)) {
    parts.push(<span key="body" className="text-[#3fb950]">{rest}</span>)
  } else {
    parts.push(<span key="body" className="text-[#8b949e]">{rest}</span>)
  }
  return <>{parts}</>
}

// =============================================================================
// ADD INVENTORY SECTION (extracted from inventory-intel page)
// =============================================================================

interface AddInventoryForm {
  part_number: string; description: string; condition: string; quantity: string
  unit_price: string; serial_number: string; warehouse_code: string
  certificate_type: string; trace: string
}

const EMPTY_FORM: AddInventoryForm = {
  part_number: '', description: '', condition: '', quantity: '',
  unit_price: '', serial_number: '', warehouse_code: '', certificate_type: '', trace: '',
}

function AddInventorySection({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AddInventoryForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const set = useCallback((field: keyof AddInventoryForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setSubmitError(null); setSuccess(false)
    }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setSubmitError(null); setSuccess(false)
    try {
      const body = {
        part_number: form.part_number.trim().toUpperCase(),
        description: form.description.trim() || null,
        condition: form.condition || null,
        quantity: parseInt(form.quantity, 10),
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        serial_number: form.serial_number.trim() || null,
        warehouse_code: form.warehouse_code.trim() || null,
        certificate_type: form.certificate_type.trim() || null,
        trace: form.trace.trim() || null,
      }
      const res = await fetchWithTimeout('/api/internal/inventory-intelligence/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Failed to add inventory (${res.status})`)
      }
      setForm(EMPTY_FORM); setSuccess(true); onAdded()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add inventory')
    } finally { setSubmitting(false) }
  }, [form, onAdded])

  const inputClass = 'w-full px-3 py-2 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58]'
  const labelClass = 'block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1'

  return (
    <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#3fb950]/10 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-[#3fb950]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#f0f6fc]">Add Inventory</span>
            <span className="ml-2 text-xs text-[#484f58]">Manually add a part to stock</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#484f58] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-5">
          {success && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-[#3fb950]/10 border border-[#3fb950]/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-[#3fb950] flex-shrink-0" />
              <p className="text-sm text-[#3fb950] font-medium">Part added to inventory successfully.</p>
            </div>
          )}
          {submitError && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-[#f85149]/10 border border-[#f85149]/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-[#f85149] flex-shrink-0" />
              <p className="text-sm text-[#f85149]">{submitError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Part Number <span className="text-[#f85149]">*</span></label>
                <input type="text" required value={form.part_number} onChange={set('part_number')} placeholder="e.g. 69-37184-5" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Condition <span className="text-[#f85149]">*</span></label>
                <select required value={form.condition} onChange={set('condition')} className={inputClass}>
                  <option value="">Select condition</option>
                  <option value="NE">NE — New</option>
                  <option value="OH">OH — Overhauled</option>
                  <option value="SV">SV — Serviceable</option>
                  <option value="AR">AR — As Removed</option>
                  <option value="FN">FN — Factory New</option>
                  <option value="RP">RP — Repaired</option>
                  <option value="NS">NS — New Surplus</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Quantity <span className="text-[#f85149]">*</span></label>
                <input type="number" required min="1" value={form.quantity} onChange={set('quantity')} placeholder="1" className={inputClass} />
              </div>
            </div>
            <div className="mb-4">
              <label className={labelClass}>Description</label>
              <input type="text" value={form.description} onChange={set('description')} placeholder="Part description" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass}>Unit Price (USD)</label>
                <input type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Serial Number</label>
                <input type="text" value={form.serial_number} onChange={set('serial_number')} placeholder="S/N optional" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Warehouse Code</label>
                <input type="text" value={form.warehouse_code} onChange={set('warehouse_code')} placeholder="e.g. MIA-A1" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelClass}>Certificate Type</label>
                <input type="text" value={form.certificate_type} onChange={set('certificate_type')} placeholder="8130, EASA Form 1, C of C…" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trace / Back-to-Birth</label>
                <input type="text" value={form.trace} onChange={set('trace')} placeholder="Trace documentation reference" className={inputClass} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setForm(EMPTY_FORM); setSubmitError(null); setSuccess(false) }}
                className="px-4 py-2 text-sm font-medium text-[#8b949e] bg-white/[0.06] rounded-lg hover:bg-white/[0.08] border border-white/[0.06] transition-colors">
                Clear
              </button>
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#1f6feb] rounded-lg hover:bg-[#388bfd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" />Adding…</> : <><Plus className="w-4 h-4" />Add to Inventory</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SUB-TAB: FLEET
// =============================================================================

function FleetTab() {
  const [data, setData] = useState<BotDashboardData | null>(null)
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedBot, setSelectedBot] = useState('ils')
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [restartingBot, setRestartingBot] = useState<string | null>(null)
  const [restartResult, setRestartResult] = useState<string | null>(null)

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const [botsRes, invRes] = await Promise.all([
        fetchWithTimeout('/api/internal/bots'),
        fetchWithTimeout('/api/internal/bots/inventory'),
      ])
      if (!botsRes.ok) throw new Error('Failed to load bot data')
      setData(await botsRes.json())
      if (invRes.ok) setInventory(await invRes.json())
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally { setLoading(false) }
  }

  async function loadLogs(botKey: string) {
    setLogLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/internal/bots/logs?bot=${botKey}&lines=100`)
      if (res.ok) { const json = await res.json(); setLogContent(json.content || 'No log content') }
    } catch { setLogContent('Failed to load logs') } finally { setLogLoading(false) }
  }

  async function restartBot(botKey: string) {
    if (!confirm(`Are you sure you want to restart ${botKey.toUpperCase()}?`)) return
    setRestartingBot(botKey); setRestartResult(null)
    try {
      const res = await fetchWithTimeout('/api/internal/bots/restart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botName: botKey, confirm: true }),
        timeoutMs: 35000,
      })
      const json = await res.json()
      setRestartResult(json.message || (json.success ? 'Restarted' : 'Failed'))
      if (json.success) loadData()
    } catch { setRestartResult('Restart request failed') } finally { setRestartingBot(null) }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { const i = setInterval(loadData, 30000); return () => clearInterval(i) }, [])
  useEffect(() => { loadLogs(selectedBot) }, [selectedBot])

  const allMetrics = data?.metrics || {}
  const quotesToday = allMetrics.ils?.['Quotes Created'] || 0
  const reportsSent = allMetrics.internal?.['8130 Reports'] || 0
  const aogLeads = allMetrics.aog?.['AOG Leads'] || 0
  const inventoryAlerts = allMetrics.inventory?.['Alerts Sent'] || 0
  const syncsCompleted = allMetrics.sync?.['Files Synced'] || 0

  const sparklines = useMemo(() => {
    const map: Record<string, { v: number }[]> = {}
    data?.statuses.forEach((bot) => { map[bot.key] = generateSparkline(bot.key) })
    return map
  }, [data?.statuses])

  const highlightedLog = useMemo(() => {
    if (!logContent) return null
    return logContent.split('\n').map((line, idx) => (
      <div key={idx} className="leading-relaxed">{highlightLogLine(line)}</div>
    ))
  }, [logContent])

  if (loading && !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4 space-y-3">
              <div className="h-3 w-16 bg-white/[0.06] rounded" /><div className="h-4 w-24 bg-white/[0.06] rounded" />
              <div className="h-3 w-32 bg-white/[0.04] rounded" /><div className="h-[30px] w-[80px] bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#f85149] mx-auto mb-3" />
          <p className="text-[#f85149] font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-[#58a6ff] hover:underline">Try again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[#484f58] text-xs font-mono tabular-nums">
          Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 30s)
        </p>
        <button onClick={loadData} disabled={loading} aria-label="Refresh fleet"
          className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bot Status Cards */}
      <FadeIn delay={60}><SectionDivider label="Bot Status" icon={Cpu} /></FadeIn>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {data?.statuses.map((bot, idx) => {
          const metrics = allMetrics[bot.key] || {}
          const primaryMetric = Object.entries(metrics)[0]
          const sparkData = sparklines[bot.key] || []
          const isRunning = bot.status === 'RUNNING'
          return (
            <FadeIn key={bot.key} delay={100 + idx * 80}>
              <div
                className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-all duration-200"
                style={isRunning ? { boxShadow: '0 0 0 1px rgba(63,185,80,0.12), 0 0 16px rgba(63,185,80,0.06)' } : undefined}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isRunning
                          ? 'bg-[#3fb950] bot-running-dot'
                          : bot.status === 'STOPPED'
                          ? 'bg-[#f85149]'
                          : 'bg-[#d29922]'
                      }`}
                    />
                    <StatusDot status={bot.status} />
                  </div>
                </div>
                <h3 className="font-bold text-[#f0f6fc] text-sm">{bot.displayName}</h3>
                <p className="text-xs text-[#8b949e] mt-1 line-clamp-2">{bot.description}</p>
                {primaryMetric && (
                  <p className="text-xs text-[#8b949e] mt-2 font-medium">
                    {primaryMetric[0]}: <span className="text-[#f0f6fc] font-bold">{primaryMetric[1]}</span>
                  </p>
                )}
                <div className="mt-3">
                  <BotSparklineDynamic data={sparkData} isRunning={isRunning} />
                </div>
              </div>
            </FadeIn>
          )
        })}
      </div>

      {/* Key Metrics */}
      <FadeIn delay={500}><SectionDivider label="Key Metrics" icon={Activity} /></FadeIn>
      <FadeIn delay={560}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={MessageSquare} label="Quotes Today" value={quotesToday} color="purple" />
          <StatCard icon={Activity} label="Reports Sent" value={reportsSent} color="blue" />
          <StatCard icon={AlertCircle} label="AOG Leads" value={aogLeads} color="red" />
          <StatCard icon={Bot} label="Inventory Alerts" value={inventoryAlerts} color="orange" />
          <StatCard icon={RefreshCw} label="Syncs Done" value={syncsCompleted} color="teal" />
        </div>
      </FadeIn>

      {/* Inventory Snapshot */}
      {inventory && (
        <>
          <FadeIn delay={640}><SectionDivider label="Inventory Snapshot" icon={Package} /></FadeIn>
          <FadeIn delay={700}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Layers} label="Pending Drafts" value={inventory.pendingDrafts} color="purple" />
              <StatCard icon={Activity} label="Committed Stock" value={inventory.committedStock} color="green" />
              <StatCard icon={Bot} label="Total SKUs" value={inventory.totalSkus} color="blue" />
              <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
                <p className="text-xs text-[#8b949e] font-medium mb-2">Condition Breakdown</p>
                <div className="flex flex-wrap gap-1">
                  {inventory.conditionBreakdown.map((c) => (
                    <span key={c.condition} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] text-[#8b949e] border border-white/[0.08]">
                      {c.condition || 'N/A'}: {c.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </>
      )}

      {/* Notifications + Log Viewer */}
      <FadeIn delay={780}><SectionDivider label="Activity & Logs" icon={Terminal} /></FadeIn>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={840}>
          <ChartCard title="Notification Feed" icon={Activity} iconColor="text-[#58a6ff]" subtitle={`${data?.notifications.length || 0} events`}>
            <div className="max-h-[400px] overflow-y-auto -mx-5 -mb-5 divide-y divide-white/[0.04]">
              {data?.notifications.map((n, i) => (
                <div key={i} className="px-5 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[#484f58] font-mono">{formatDateShort(n.timestamp)}</span>
                    <BotBadge name={n.bot} />
                    <SeverityBadge severity={n.severity} />
                  </div>
                  <p className="text-xs text-[#8b949e] truncate">{n.event}</p>
                </div>
              ))}
              {(!data?.notifications || data.notifications.length === 0) && (
                <div className="px-5 py-8 text-center text-[#484f58] text-sm">No notifications today</div>
              )}
            </div>
          </ChartCard>
        </FadeIn>

        <FadeIn delay={900}>
          <ChartCard
            title="Bot Log Viewer"
            icon={Terminal}
            iconColor="text-[#3fb950]"
            action={
              <div className="relative">
                <select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)}
                  className="text-xs font-medium text-[#f0f6fc] bg-[#0b0f14] border border-white/[0.08] rounded-lg px-3 py-1.5 appearance-none pr-7 cursor-pointer focus:outline-none focus:border-[#1f6feb]">
                  {data?.statuses.map((bot) => (
                    <option key={bot.key} value={bot.key}>{bot.displayName}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#484f58] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            }
          >
            <div className="max-h-[400px] overflow-y-auto bg-[#0b0f14] rounded-lg p-4 -mx-1">
              {logLoading ? (
                <div className="text-[#484f58] text-xs text-center py-4 animate-pulse">Loading logs...</div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {highlightedLog || <span className="text-[#484f58]">No log content available</span>}
                </pre>
              )}
            </div>
          </ChartCard>
        </FadeIn>
      </div>

      {/* Service Controls */}
      <FadeIn delay={960}><SectionDivider label="Service Controls" icon={RotateCcw} /></FadeIn>
      <FadeIn delay={1020}>
        <ChartCard title="Restart Services" icon={RotateCcw} iconColor="text-[#ffa657]" subtitle="Manually restart a bot service">
          {restartResult && (
            <div className="mb-4 p-3 rounded-lg bg-[#58a6ff]/10 border border-[#58a6ff]/20 text-[#58a6ff] text-sm font-medium">{restartResult}</div>
          )}
          <div className="flex flex-wrap gap-3">
            {data?.statuses.map((bot) => (
              <button key={bot.key} onClick={() => restartBot(bot.key)} disabled={restartingBot === bot.key}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#8b949e] bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-[#ffa657]/10 hover:border-[#ffa657]/20 hover:text-[#ffa657] transition-colors disabled:opacity-50">
                <RotateCcw className={`w-3.5 h-3.5 ${restartingBot === bot.key ? 'animate-spin' : ''}`} />
                Restart {bot.displayName}
              </button>
            ))}
          </div>
        </ChartCard>
      </FadeIn>
    </div>
  )
}

// =============================================================================
// SUB-TAB: INVENTORY INTEL
// =============================================================================

function InventoryIntelTab() {
  const [data, setData] = useState<InvDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCondition, setSearchCondition] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [pdfRows, setPdfRows] = useState<ParsedPdfRow[] | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchSearchResponse | null>(null)
  const [batchSearchLoading, setBatchSearchLoading] = useState(false)
  const [batchSearchError, setBatchSearchError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-intelligence')
      if (!res.ok) throw new Error('Failed to load inventory intelligence')
      setData(await res.json()); setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally { setLoading(false) }
  }

  const performSearch = useCallback(async (q: string, cond: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ q })
      if (cond) params.set('condition', cond)
      const res = await fetchWithTimeout(`/api/internal/inventory-intelligence/search?${params}`)
      if (res.ok) { const json = await res.json(); setSearchResults(json.results || []) }
    } catch { setSearchResults([]) } finally { setSearchLoading(false) }
  }, [])

  const handlePdfParsed = useCallback((response: ParsePdfResponse) => {
    setPdfRows(response.rows); setPdfFileName(response.fileName)
    setPdfPageCount(response.pageCount); setBatchResults(null); setBatchSearchError(null)
  }, [])

  const handleBatchSearch = useCallback(async (selectedRows: ParsedPdfRow[]) => {
    setBatchSearchLoading(true); setBatchSearchError(null)
    try {
      const partNumbers = selectedRows.map(r => r.partNumber)
      const includeAlts: Record<string, string[]> = {}
      for (const row of selectedRows) {
        if (row.altPartNumbers.length > 0) includeAlts[row.partNumber] = row.altPartNumbers
      }
      const res = await fetchWithTimeout('/api/internal/inventory-intelligence/batch-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumbers, includeAlts }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Batch search failed (${res.status})`)
      }
      setBatchResults(await res.json())
    } catch (err) {
      setBatchSearchError(err instanceof Error ? err.message : 'Batch search failed')
    } finally { setBatchSearchLoading(false) }
  }, [])

  const resetCCheckState = useCallback(() => {
    setPdfRows(null); setPdfFileName(null); setPdfPageCount(0)
    setBatchResults(null); setBatchSearchLoading(false); setBatchSearchError(null)
  }, [])

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    const timeout = setTimeout(() => performSearch(searchQuery, searchCondition), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchCondition, performSearch])

  const pieData = useMemo(() => {
    if (!data?.conditionBreakdown) return []
    return data.conditionBreakdown.map((c) => ({ name: c.condition || 'N/A', value: c.count }))
  }, [data?.conditionBreakdown])

  const pieColors = useMemo(() => {
    if (!data?.conditionBreakdown) return []
    let fallbackIdx = 0
    return data.conditionBreakdown.map((c) => {
      const known = CONDITION_COLORS[c.condition]
      if (known) return known.hex
      const fb = PIE_FALLBACK_COLORS[fallbackIdx % PIE_FALLBACK_COLORS.length]; fallbackIdx++
      return fb
    })
  }, [data?.conditionBreakdown])

  const barData = useMemo(() => {
    if (!data?.salesVelocity) return []
    return data.salesVelocity.slice(0, 10).map((v) => ({
      part: v.part_number.length > 14 ? v.part_number.slice(0, 12) + '...' : v.part_number,
      '7d': v.sold_last_7d, '30d': v.sold_last_30d, '90d': v.sold_last_90d,
    }))
  }, [data?.salesVelocity])

  const velocityColumns = [
    { key: 'part_number', label: 'Part Number', sortable: true, render: (row: VelocityItem) => <span className="font-medium text-[#f0f6fc]">{row.part_number}</span> },
    { key: 'sold_last_7d', label: '7d Sold', align: 'right' as const, sortable: true },
    { key: 'sold_last_30d', label: '30d Sold', align: 'right' as const, sortable: true },
    { key: 'sold_last_90d', label: '90d Sold', align: 'right' as const, sortable: true },
    { key: 'total_revenue_30d', label: '30d Revenue', align: 'right' as const, sortable: true, render: (row: VelocityItem) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(row.total_revenue_30d)}</span> },
    { key: 'velocity_tier', label: 'Tier', sortable: true, render: (row: VelocityItem) => <VelocityBadge tier={row.velocity_tier} /> },
  ]

  const alertColumns = [
    { key: 'alert_type', label: 'Type', sortable: true, render: (row: InvAlertItem) => <AlertTypeBadge type={row.alert_type} /> },
    { key: 'part_number', label: 'Part Number', sortable: true, render: (row: InvAlertItem) => <span className="font-medium text-[#f0f6fc]">{row.part_number}</span> },
    { key: 'serial_number', label: 'Serial', sortable: true, render: (row: InvAlertItem) => <span className="text-[#8b949e]">{row.serial_number || '—'}</span> },
    { key: 'details', label: 'Details', render: (row: InvAlertItem) => <span className="text-[#8b949e] truncate block max-w-[300px]">{row.details}</span> },
    { key: 'created_at', label: 'Time', sortable: true, render: (row: InvAlertItem) => <span className="text-[#484f58] text-xs">{formatDate(row.created_at)}</span> },
  ]

  const searchColumns = [
    { key: 'part_number', label: 'Part Number', sortable: true, render: (row: SearchResult) => <span className="font-medium text-[#f0f6fc]">{row.part_number}</span> },
    { key: 'description', label: 'Description', render: (row: SearchResult) => <span className="text-[#8b949e] truncate block max-w-[200px]">{row.description || '—'}</span> },
    { key: 'condition', label: 'Condition', sortable: true, render: (row: SearchResult) => <ConditionPill condition={row.condition || ''} count={row.quantity} /> },
    { key: 'quantity', label: 'Qty', align: 'right' as const, sortable: true },
    { key: 'warehouse_code', label: 'Warehouse', sortable: true, render: (row: SearchResult) => <span className="text-[#8b949e]">{row.warehouse_code || '—'}</span> },
    { key: 'unit_price', label: 'Unit Price', align: 'right' as const, sortable: true, render: (row: SearchResult) => <span className="font-medium text-[#f0f6fc]">{formatCurrency(row.unit_price)}</span> },
  ]

  if (loading && !data) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCard key={i} icon={Package} label="" value="" color="slate" loading />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="" loading /><ChartCard title="" loading />
        </div>
        <DataTable columns={velocityColumns} data={[]} loading />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#f85149] mx-auto mb-3" />
          <p className="text-[#f85149] font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-[#58a6ff] hover:underline">Try again</button>
        </div>
      </div>
    )
  }

  const summary = data?.summary
  const syncAge = data?.syncStatus?.lastSync && data.syncStatus.lastSync !== 'Unknown'
    ? new Date(data.syncStatus.lastSync).toLocaleString() : 'Unknown'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[#484f58] text-xs font-mono tabular-nums">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
        <button onClick={loadData} disabled={loading} aria-label="Refresh inventory"
          className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Inventory Search */}
      <FadeIn delay={80}><SectionDivider label="Inventory Search" icon={Search} /></FadeIn>
      <FadeIn delay={120}>
        <ChartCard title="Inventory Search" icon={Search} iconColor="text-[#58a6ff]">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#484f58] absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by part number..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58]" />
            </div>
            <select value={searchCondition} onChange={(e) => setSearchCondition(e.target.value)}
              className="text-sm border border-white/[0.08] rounded-lg px-3 py-2 bg-[#0b0f14] text-[#f0f6fc] focus:outline-none focus:border-[#1f6feb]">
              <option value="">All Conditions</option>
              <option value="NE">NE — New</option>
              <option value="OH">OH — Overhauled</option>
              <option value="SV">SV — Serviceable</option>
              <option value="AR">AR — As Removed</option>
            </select>
          </div>
          {searchLoading && <DataTable columns={searchColumns} data={[]} loading />}
          {!searchLoading && searchResults.length > 0 && (
            <>
              <DataTable<SearchResult> columns={searchColumns} data={searchResults} emptyMessage="No results" />
              <p className="text-xs text-[#484f58] mt-2">{searchResults.length} results</p>
            </>
          )}
          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-6 text-[#484f58] text-sm">No results found for &ldquo;{searchQuery}&rdquo;</div>
          )}
        </ChartCard>
      </FadeIn>

      {/* Add Inventory */}
      <FadeIn delay={160}><AddInventorySection onAdded={loadData} /></FadeIn>

      {/* C Check Part Lookup */}
      <FadeIn delay={200}><SectionDivider label="C Check Part Lookup" icon={FileText} /></FadeIn>
      <FadeIn delay={240}>
        <ChartCard title="C Check Part Lookup" icon={FileText} iconColor="text-indigo-500" subtitle="Upload a C Check pre-draw PDF to bulk-check part availability">
          {batchSearchLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-white/[0.08] border-t-[#1f6feb] rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-[#8b949e]">Searching inventory...</p>
              <p className="text-xs text-[#484f58] mt-1">Checking local database and ERP AERO</p>
            </div>
          ) : batchSearchError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-10 h-10 text-[#f85149] mb-3" />
              <p className="text-sm font-medium text-[#f85149]">{batchSearchError}</p>
              <button onClick={resetCCheckState} className="mt-3 text-sm text-[#58a6ff] hover:underline">Try again</button>
            </div>
          ) : batchResults ? (
            <InventoryMatchResults results={batchResults} onReset={resetCCheckState} />
          ) : pdfRows ? (
            <PdfReviewTable rows={pdfRows} fileName={pdfFileName || ''} pageCount={pdfPageCount} onSearch={handleBatchSearch} onReset={resetCCheckState} />
          ) : (
            <PdfDropZone onParsed={handlePdfParsed} />
          )}
        </ChartCard>
      </FadeIn>

      {/* Summary Stats */}
      <FadeIn delay={320}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Package} label="Pending Drafts" value={summary?.pendingDrafts ?? 0} color="purple" />
          <StatCard icon={BarChart3} label="Committed Stock" value={summary?.committedStock ?? 0} color="green" />
          <StatCard icon={Package} label="Total SKUs" value={summary?.totalSkus ?? 0} color="blue" />
          <StatCard icon={AlertTriangle} label="Today's Alerts" value={summary?.todayAlerts ?? 0} color="yellow" />
          <StatCard icon={Clock} label="Sync Status" value={data?.syncStatus?.isStale ? 'STALE' : 'OK'} color={data?.syncStatus?.isStale ? 'red' : 'green'} subtitle={syncAge} />
          <StatCard icon={TrendingUp} label="Velocity Items" value={data?.salesVelocity?.length ?? 0} color="teal" />
        </div>
      </FadeIn>

      {/* Condition Breakdown */}
      <FadeIn delay={360}><SectionDivider label="Condition Breakdown" icon={PieChartIcon} /></FadeIn>
      <FadeIn delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-5 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-[#8b949e] mb-3">By Condition Code</h3>
            <div className="flex flex-wrap gap-2">
              {data?.conditionBreakdown.map((c) => (
                <ConditionPill key={c.condition} condition={c.condition} count={c.count} />
              ))}
              {(!data?.conditionBreakdown || data.conditionBreakdown.length === 0) && (
                <p className="text-sm text-[#484f58]">No condition data available</p>
              )}
            </div>
          </div>
          <ChartCard title="SKU Distribution" icon={PieChartIcon} iconColor="text-[#a371f7]">
            <SkuPieChartDynamic pieData={pieData} pieColors={pieColors} />
          </ChartCard>
        </div>
      </FadeIn>

      {/* Sales Velocity */}
      <FadeIn delay={480}><SectionDivider label="Sales Velocity" icon={TrendingUp} /></FadeIn>
      <FadeIn delay={520}>
        <ChartCard title="Top 10 Movers — Units Sold" icon={BarChart3} iconColor="text-[#39d353]" subtitle="Grouped by 7-day, 30-day, and 90-day windows">
          <VelocityBarChartDynamic barData={barData} />
        </ChartCard>
      </FadeIn>

      <FadeIn delay={560}>
        <ChartCard title="Sales Velocity — Top Movers" icon={TrendingUp} iconColor="text-teal-500">
          <DataTable<VelocityItem> columns={velocityColumns} data={data?.salesVelocity ?? []} emptyMessage="No velocity data available" loading={loading && !data} />
        </ChartCard>
      </FadeIn>

      {/* Recent Alerts */}
      <FadeIn delay={640}><SectionDivider label="Alerts" icon={AlertTriangle} /></FadeIn>
      <FadeIn delay={680}>
        <ChartCard title="Recent Alerts" icon={AlertTriangle} iconColor="text-yellow-500">
          <DataTable<InvAlertItem> columns={alertColumns} data={data?.alerts ?? []} emptyMessage="No recent alerts" loading={loading && !data} />
        </ChartCard>
      </FadeIn>
    </div>
  )
}

// =============================================================================
// SUB-TAB: ALARMS
// =============================================================================

function AlarmsTab() {
  const [data, setData] = useState<AlarmDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ErpPart[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-alarms')
      if (!res.ok) throw new Error('Failed to load alarm data')
      setData(await res.json()); setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally { setLoading(false) }
  }

  async function runCheck() {
    setChecking(true); setCheckResult(null)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-alarms/check', { method: 'POST' })
      if (!res.ok) throw new Error('Check failed')
      setCheckResult(await res.json()); await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally { setChecking(false) }
  }

  async function acknowledgeAlarm(alertId: number) {
    setActionLoading(`ack-${alertId}`)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-alarms/acknowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_id: alertId }),
      })
      if (res.ok) await loadData()
    } finally { setActionLoading(null) }
  }

  async function removeFromWatchlist(id: number) {
    setActionLoading(`rm-${id}`)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-alarms/watchlist', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      if (res.ok) await loadData()
    } finally { setActionLoading(null) }
  }

  async function addToWatchlist(part: ErpPart) {
    if (!part.condition) return
    setActionLoading(`add-${part.part_number}-${part.condition}`)
    try {
      const res = await fetchWithTimeout('/api/internal/inventory-alarms/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_number: part.part_number, condition_code: part.condition, description: part.description || null }),
      })
      if (res.ok) await loadData()
    } finally { setActionLoading(null) }
  }

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/internal/inventory-alarms/search?${new URLSearchParams({ q })}`)
      if (res.ok) { const json = await res.json(); setSearchResults(json.parts || []) }
    } catch { setSearchResults([]) } finally { setSearchLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [])
  useEffect(() => { const i = setInterval(loadData, 60000); return () => clearInterval(i) }, [])
  useEffect(() => {
    const timeout = setTimeout(() => performSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, performSearch])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="flex items-center gap-3 text-[#8b949e]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading inventory alarms...</span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-[#f85149] mx-auto mb-3" />
          <p className="text-[#f85149] font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-[#58a6ff] hover:underline">Try again</button>
        </div>
      </div>
    )
  }

  const summary = data?.summary
  const unacknowledgedAlarms = data?.recentAlarms?.filter(a => !a.acknowledged_at) || []
  const acknowledgedAlarms = data?.recentAlarms?.filter(a => a.acknowledged_at) || []
  const watchedPartKeys = new Set(data?.watchlist?.map(w => `${w.part_number}|${w.condition_code}`) || [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[#484f58] text-xs font-mono tabular-nums">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
        <div className="flex items-center gap-2">
          <button onClick={runCheck} disabled={checking}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#f85149]/80 hover:bg-[#f85149] rounded-lg border border-[#f85149]/40 transition-colors disabled:opacity-50">
            <Shield className={`w-4 h-4 ${checking ? 'animate-pulse' : ''}`} />
            {checking ? 'Checking...' : 'Check Now'}
          </button>
          <button onClick={loadData} disabled={loading} aria-label="Refresh alarms"
            className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Check Result Banner */}
      {checkResult && (
        <div className={`rounded-xl border p-4 ${checkResult.alarms_triggered > 0 ? 'bg-[#f85149]/10 border-[#f85149]/20' : 'bg-[#3fb950]/10 border-[#3fb950]/20'}`}>
          <div className="flex items-center gap-2">
            {checkResult.alarms_triggered > 0
              ? <AlertTriangle className="w-5 h-5 text-[#f85149]" />
              : <CheckCircle className="w-5 h-5 text-[#3fb950]" />}
            <span className={`font-medium ${checkResult.alarms_triggered > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
              Checked {checkResult.checked} parts — {checkResult.alarms_triggered} alarm{checkResult.alarms_triggered !== 1 ? 's' : ''} triggered
            </span>
          </div>
          {checkResult.alarms.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checkResult.alarms.map((a, i) => (
                <li key={i} className="text-sm text-[#f85149]">
                  {a.part_number} ({a.condition_code}): qty dropped from {a.previous_qty} to {a.current_qty}
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setCheckResult(null)} className="mt-2 text-xs text-[#484f58] hover:text-[#8b949e] underline">Dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#58a6ff]/10 text-[#58a6ff]"><Eye className="w-5 h-5" /></div>
            <div><p className="text-xs text-[#8b949e] font-medium">Watched Parts</p><p className="text-xl font-extrabold text-[#f0f6fc]">{summary?.watchedParts || 0}</p></div>
          </div>
        </div>
        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${summary?.activeAlarms ? 'bg-[#f85149]/10 text-[#f85149]' : 'bg-[#3fb950]/10 text-[#3fb950]'}`}><Bell className="w-5 h-5" /></div>
            <div><p className="text-xs text-[#8b949e] font-medium">Active Alarms</p><p className="text-xl font-extrabold text-[#f0f6fc]">{summary?.activeAlarms || 0}</p></div>
          </div>
        </div>
        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#58a6ff]/10 text-[#58a6ff]"><Package className="w-5 h-5" /></div>
            <div><p className="text-xs text-[#8b949e] font-medium">OH Watched</p><p className="text-xl font-extrabold text-[#f0f6fc]">{summary?.ohWatched || 0}</p></div>
          </div>
        </div>
        <div className="bg-[#161b22] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ffa657]/10 text-[#ffa657]"><Package className="w-5 h-5" /></div>
            <div><p className="text-xs text-[#8b949e] font-medium">AR Watched</p><p className="text-xl font-extrabold text-[#f0f6fc]">{summary?.arWatched || 0}</p></div>
          </div>
        </div>
      </div>

      {/* Active Alarms Table */}
      <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#f85149]" />
          <h2 className="font-bold text-[#f0f6fc]">Active Alarms</h2>
          {unacknowledgedAlarms.length > 0 && (
            <span className="ml-auto text-xs font-bold text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/20 px-2 py-0.5 rounded-full">
              {unacknowledgedAlarms.length} unacknowledged
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left border-b border-white/[0.06]">
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Type</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Details</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Time</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Status</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {unacknowledgedAlarms.map((alarm) => (
                <tr key={alarm.id} className="hover:bg-[#f85149]/[0.04] transition-colors">
                  <td className="px-4 py-3"><AlarmTypeBadge type={alarm.alert_type} /></td>
                  <td className="px-4 py-3 font-medium text-[#f0f6fc]">{alarm.part_number}</td>
                  <td className="px-4 py-3 text-[#8b949e] truncate max-w-[300px]">{alarm.details}</td>
                  <td className="px-4 py-3 text-[#484f58] text-xs">{formatDate(alarm.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20">Unacknowledged</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => acknowledgeAlarm(alarm.id)} disabled={actionLoading === `ack-${alarm.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#3fb950] bg-[#3fb950]/10 border border-[#3fb950]/20 rounded-lg hover:bg-[#3fb950]/20 transition-colors disabled:opacity-50">
                      <CheckCircle className="w-3 h-3" />
                      {actionLoading === `ack-${alarm.id}` ? 'Ack...' : 'Acknowledge'}
                    </button>
                  </td>
                </tr>
              ))}
              {acknowledgedAlarms.slice(0, 10).map((alarm) => (
                <tr key={alarm.id} className="hover:bg-white/[0.02] transition-colors opacity-50">
                  <td className="px-4 py-3"><AlarmTypeBadge type={alarm.alert_type} /></td>
                  <td className="px-4 py-3 font-medium text-[#f0f6fc]">{alarm.part_number}</td>
                  <td className="px-4 py-3 text-[#8b949e] truncate max-w-[300px]">{alarm.details}</td>
                  <td className="px-4 py-3 text-[#484f58] text-xs">{formatDate(alarm.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20">
                      Ack by {alarm.acknowledged_by}
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))}
              {(data?.recentAlarms?.length || 0) === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[#484f58]">No alarms</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#58a6ff]" />
          <h2 className="font-bold text-[#f0f6fc]">Watchlist</h2>
          <span className="ml-auto text-xs text-[#484f58]">{data?.watchlist?.length || 0} parts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left border-b border-white/[0.06]">
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Condition</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Description</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider text-right">Last Qty</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Last Checked</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Added By</th>
                <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data?.watchlist?.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#f0f6fc]">{item.part_number}</td>
                  <td className="px-4 py-3"><ConditionBadge condition={item.condition_code} /></td>
                  <td className="px-4 py-3 text-[#8b949e] truncate max-w-[200px]">{item.description || '\u2014'}</td>
                  <td className="px-4 py-3 text-right"><QtyIndicator qty={item.last_known_qty} /></td>
                  <td className="px-4 py-3 text-[#484f58] text-xs">{formatDate(item.last_checked_at)}</td>
                  <td className="px-4 py-3 text-[#484f58] text-xs">{item.added_by}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeFromWatchlist(item.id)} disabled={actionLoading === `rm-${item.id}`}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#f85149] hover:bg-[#f85149]/10 rounded-lg transition-colors disabled:opacity-50">
                      <Trash2 className="w-3 h-3" />
                      {actionLoading === `rm-${item.id}` ? '...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
              {(!data?.watchlist || data.watchlist.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[#484f58]">No parts being watched</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add to Watchlist */}
      <div className="bg-[#161b22] rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#3fb950]" />
          <h2 className="font-bold text-[#f0f6fc]">Add to Watchlist</h2>
        </div>
        <div className="p-5">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-[#484f58] absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ERP parts by part number..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58]" />
            </div>
          </div>
          {searchLoading && <div className="text-center py-4 text-[#484f58] text-sm">Searching ERP...</div>}
          {searchResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.04] text-left border-b border-white/[0.06]">
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Part Number</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Description</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Condition</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider text-right">Qty</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider text-right">Price</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider">Warehouse</th>
                    <th className="px-4 py-2.5 font-semibold text-[#8b949e] uppercase text-xs tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {searchResults.map((part, i) => {
                    const isWatched = watchedPartKeys.has(`${part.part_number}|${part.condition}`)
                    return (
                      <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#f0f6fc]">{part.part_number}</td>
                        <td className="px-4 py-3 text-[#8b949e] truncate max-w-[200px]">{part.description || '\u2014'}</td>
                        <td className="px-4 py-3">{part.condition ? <ConditionBadge condition={part.condition} /> : '\u2014'}</td>
                        <td className="px-4 py-3 text-right"><QtyIndicator qty={part.quantity} /></td>
                        <td className="px-4 py-3 text-right font-medium text-[#f0f6fc]">{formatCurrency(part.unit_price)}</td>
                        <td className="px-4 py-3 text-[#8b949e]">{part.warehouse || '\u2014'}</td>
                        <td className="px-4 py-3">
                          {part.condition ? (
                            isWatched ? (
                              <span className="text-xs text-[#3fb950] font-medium flex items-center gap-1"><Eye className="w-3 h-3" /> Watching</span>
                            ) : (
                              <button onClick={() => addToWatchlist(part)} disabled={actionLoading === `add-${part.part_number}-${part.condition}`}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#58a6ff] bg-[#58a6ff]/10 border border-[#58a6ff]/20 rounded-lg hover:bg-[#58a6ff]/20 transition-colors disabled:opacity-50">
                                <Plus className="w-3 h-3" />
                                {actionLoading === `add-${part.part_number}-${part.condition}` ? 'Adding...' : 'Watch'}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-[#484f58]">No condition</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-[#484f58] mt-2 px-4">{searchResults.length} results from ERP</p>
            </div>
          )}
          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-6 text-[#484f58] text-sm">No ERP results for &ldquo;{searchQuery}&rdquo;</div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SUB-TAB: QUOTES
// =============================================================================

const statusMap: Record<string, string> = {
  pending: 'Pending',
  processed: 'In Progress',
  responded: 'Completed',
}

function QuotesTab() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [stats, setStats] = useState<QuoteStats>({ pending: 0, processed: 0, responded: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null)
  const [quoteResponses, setQuoteResponses] = useState<QuoteResponse[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [composeTemplate, setComposeTemplate] = useState('custom')
  const [composeMessage, setComposeMessage] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [sending, setSending] = useState(false)

  async function fetchQuotes() {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetchWithTimeout(`/api/internal/quotes?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load quotes')
      const data = await res.json()
      setQuotes(data.quotes || [])
      setStats(data.stats || { pending: 0, processed: 0, responded: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotes')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchQuotes() }, [statusFilter])
  useEffect(() => { const timer = setTimeout(() => fetchQuotes(), 400); return () => clearTimeout(timer) }, [searchQuery])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetchWithTimeout('/api/internal/quotes/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Sync failed') }
      await fetchQuotes()
    } catch (e) { setError(e instanceof Error ? e.message : 'Sync failed') } finally { setSyncing(false) }
  }

  async function handleExport() {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    window.open(`/api/internal/quotes/export?${params.toString()}`, '_blank')
  }

  async function handleStatusChange(quoteId: number, newStatus: string) {
    try {
      await fetchWithTimeout(`/api/internal/quotes/${quoteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      await fetchQuotes()
      if (selectedQuote?.id === quoteId) setSelectedQuote({ ...selectedQuote, status: newStatus as any })
    } catch { /* ignore */ }
  }

  async function openDetail(quote: QuoteRequest) {
    setSelectedQuote(quote); setDetailLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/internal/quotes/${quote.id}`)
      if (res.ok) { const data = await res.json(); setQuoteResponses(data.responses || []) }
    } finally { setDetailLoading(false) }
  }

  async function handleSendEmail() {
    if (!selectedQuote) return
    setSending(true)
    try {
      const res = await fetchWithTimeout(`/api/internal/quotes/${selectedQuote.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: composeTemplate, customMessage: composeMessage, customSubject: composeSubject || `Re: ${selectedQuote.subject}` }),
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to send') }
      setShowCompose(false); setComposeMessage(''); setComposeSubject('')
      await fetchQuotes(); openDetail(selectedQuote)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to send email') } finally { setSending(false) }
  }

  const columns = useMemo(() => [
    {
      key: 'sender_email', label: 'From', sortable: true,
      render: (row: QuoteRequest) => (
        <div>
          <div className="font-medium text-[#f0f6fc] truncate max-w-[180px]">{row.sender_name || row.sender_email}</div>
          {row.sender_name && <div className="text-xs text-[#484f58] truncate max-w-[180px]">{row.sender_email}</div>}
        </div>
      ),
    },
    {
      key: 'subject', label: 'Subject', sortable: true,
      render: (row: QuoteRequest) => <div className="max-w-[250px] truncate text-[#8b949e]" title={row.subject}>{row.subject}</div>,
    },
    {
      key: 'part_numbers', label: 'Parts',
      render: (row: QuoteRequest) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {(row.part_numbers || []).slice(0, 3).map((pn) => (
            <span key={pn} className="inline-block px-1.5 py-0.5 bg-white/[0.06] text-[#8b949e] border border-white/[0.08] text-xs rounded font-mono">{pn}</span>
          ))}
          {(row.part_numbers || []).length > 3 && <span className="text-xs text-[#484f58]">+{row.part_numbers.length - 3}</span>}
        </div>
      ),
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (row: QuoteRequest) => <StatusBadge status={statusMap[row.status] || row.status} />,
    },
    {
      key: 'received_at', label: 'Received', sortable: true,
      render: (row: QuoteRequest) => <span className="text-xs text-[#484f58] whitespace-nowrap">{formatDate(row.received_at)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right' as const,
      render: (row: QuoteRequest) => (
        <div className="flex items-center gap-1">
          {row.status === 'pending' && (
            <button onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'processed') }}
              className="p-1 text-[#58a6ff] hover:bg-[#58a6ff]/10 rounded transition-colors" title="Mark as processed">
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ], [])

  const total = stats.pending + stats.processed + stats.responded
  const filterTabs = [
    { key: '', label: 'All', count: total },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'processed', label: 'Processed', count: stats.processed },
    { key: 'responded', label: 'Responded', count: stats.responded },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[#8b949e] text-sm">Manage incoming quote requests from email</p>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1f6feb] text-white text-sm font-medium rounded-lg hover:bg-[#388bfd] disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Emails
          </button>
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] text-[#8b949e] text-sm font-medium rounded-lg border border-white/[0.06] hover:bg-white/[0.08] hover:text-[#f0f6fc] transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#f85149]/10 border border-[#f85149]/20 rounded-lg text-sm text-[#f85149]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Clock} label="Pending" value={stats.pending} color="yellow" />
        <StatCard icon={FileText} label="Processed" value={stats.processed} color="blue" />
        <StatCard icon={MessageSquare} label="Responded" value={stats.responded} color="green" />
      </div>

      {/* Filters + Table */}
      <ChartCard
        title="Quote Requests"
        icon={Mail}
        iconColor="text-[#58a6ff]"
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#484f58]" />
            <input type="text" placeholder="Search quotes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] w-56" />
          </div>
        }
      >
        <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06] -mx-5 px-5">
          {filterTabs.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${statusFilter === tab.key ? 'border-[#1f6feb] text-[#58a6ff]' : 'border-transparent text-[#484f58] hover:text-[#8b949e]'}`}>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? 'bg-[#1f6feb]/20 text-[#58a6ff]' : 'bg-white/[0.06] text-[#484f58]'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <DataTable columns={columns} data={quotes} loading={loading} onRowClick={openDetail} emptyMessage="No quote requests found" emptyIcon={<Inbox className="w-8 h-8 text-[#484f58]" />} />
      </ChartCard>

      {/* Detail Side Panel */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setSelectedQuote(null); setShowCompose(false) }} />
          <div className="relative w-full max-w-lg bg-[#161b22] border-l border-white/[0.06] shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-[#161b22] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-bold text-[#f0f6fc] truncate max-w-[300px]">{selectedQuote.subject}</h2>
                <p className="text-xs text-[#8b949e] mt-0.5">From: {selectedQuote.sender_name || selectedQuote.sender_email}</p>
              </div>
              <button onClick={() => { setSelectedQuote(null); setShowCompose(false) }} className="p-1 hover:bg-white/[0.06] rounded">
                <X className="w-5 h-5 text-[#8b949e]" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[#484f58] font-medium mb-1">Status</p>
                  <StatusBadge status={statusMap[selectedQuote.status] || selectedQuote.status} />
                </div>
                <div>
                  <p className="text-xs text-[#484f58] font-medium">Received</p>
                  <p className="text-[#f0f6fc]">{formatDate(selectedQuote.received_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#484f58] font-medium">Sender Email</p>
                  <p className="text-[#8b949e] truncate">{selectedQuote.sender_email}</p>
                </div>
                <div>
                  <p className="text-xs text-[#484f58] font-medium">Processed</p>
                  <p className="text-[#8b949e]">{formatDate(selectedQuote.processed_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-[#484f58] font-medium mb-2">Part Numbers</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedQuote.part_numbers || []).map((pn) => (
                    <span key={pn} className="px-2 py-1 bg-white/[0.06] text-[#8b949e] border border-white/[0.08] text-xs rounded font-mono">{pn}</span>
                  ))}
                  {(!selectedQuote.part_numbers || selectedQuote.part_numbers.length === 0) && (
                    <span className="text-xs text-[#484f58]">No part numbers extracted</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedQuote.status === 'pending' && (
                  <button onClick={() => handleStatusChange(selectedQuote.id, 'processed')}
                    className="px-3 py-1.5 bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20 text-sm font-medium rounded-lg hover:bg-[#58a6ff]/20 transition-colors">
                    Mark Processed
                  </button>
                )}
                <button onClick={() => { setShowCompose(true); setComposeSubject(`Re: ${selectedQuote.subject}`) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20 text-sm font-medium rounded-lg hover:bg-[#3fb950]/20 transition-colors">
                  <Send className="w-3.5 h-3.5" />
                  Send Response
                </button>
              </div>

              <div>
                <p className="text-xs text-[#484f58] font-medium mb-2">Response History</p>
                {detailLoading ? (
                  <div className="animate-pulse space-y-2"><div className="h-16 bg-white/[0.04] rounded" /></div>
                ) : quoteResponses.length === 0 ? (
                  <p className="text-sm text-[#484f58]">No responses yet</p>
                ) : (
                  <div className="space-y-3">
                    {quoteResponses.map((r) => (
                      <div key={r.id} className="border border-white/[0.06] bg-white/[0.03] rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-[#f0f6fc]">{r.sent_by}</span>
                          <span className="text-xs text-[#484f58]">{formatDate(r.sent_at)}</span>
                        </div>
                        {r.part_number && (
                          <p className="text-xs text-[#8b949e]">
                            Part: <span className="font-mono text-[#f0f6fc]">{r.part_number}</span>
                            {r.price_quoted != null && ` — $${Number(r.price_quoted).toFixed(2)}`}
                            {r.availability && ` — ${r.availability}`}
                          </p>
                        )}
                        {r.response_text && (
                          <p className="mt-2 text-xs text-[#8b949e] line-clamp-3">
                            {stripHtml(r.response_text).substring(0, 300)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {showCompose && (
                <div className="border border-[#1f6feb]/30 rounded-lg p-4 bg-[#1f6feb]/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#f0f6fc]">Compose Email Response</h3>
                    <button onClick={() => setShowCompose(false)} className="p-1 hover:bg-white/[0.06] rounded">
                      <X className="w-4 h-4 text-[#8b949e]" />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-[#8b949e] font-medium">To</label>
                    <p className="text-sm text-[#f0f6fc]">{selectedQuote.sender_email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-[#8b949e] font-medium">Template</label>
                    <select value={composeTemplate} onChange={(e) => setComposeTemplate(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc]">
                      <option value="partFound">Parts Found</option>
                      <option value="partNotFound">Parts Not Found</option>
                      <option value="mixedResults">Mixed Results</option>
                      <option value="custom">Custom Message</option>
                    </select>
                  </div>
                  {composeTemplate === 'custom' && (
                    <>
                      <div>
                        <label className="text-xs text-[#8b949e] font-medium">Subject</label>
                        <input type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc]" />
                      </div>
                      <div>
                        <label className="text-xs text-[#8b949e] font-medium">Message</label>
                        <textarea value={composeMessage} onChange={(e) => setComposeMessage(e.target.value)} rows={5}
                          className="mt-1 w-full px-3 py-1.5 text-sm border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#1f6feb] bg-[#0b0f14] text-[#f0f6fc] placeholder-[#484f58] resize-none"
                          placeholder="Type your response..." />
                      </div>
                    </>
                  )}
                  {composeTemplate !== 'custom' && (
                    <p className="text-xs text-[#484f58] italic">Email will be auto-generated using the selected template with the quote&apos;s part numbers.</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={handleSendEmail} disabled={sending || (composeTemplate === 'custom' && !composeMessage)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1f6feb] text-white text-sm font-medium rounded-lg hover:bg-[#388bfd] disabled:opacity-50 transition-colors">
                      <Send className="w-3.5 h-3.5" />
                      {sending ? 'Sending...' : 'Send Email'}
                    </button>
                    <button onClick={() => setShowCompose(false)}
                      className="px-4 py-2 text-[#8b949e] text-sm font-medium rounded-lg hover:bg-white/[0.06] transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SUB-TAB NAV CONFIG
// =============================================================================

type SubTab = 'fleet' | 'inventory-intel' | 'alarms' | 'quotes'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'fleet', label: 'Fleet' },
  { key: 'inventory-intel', label: 'Inventory Intel' },
  { key: 'alarms', label: 'Alarms' },
  { key: 'quotes', label: 'Quotes' },
]

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function BotsPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('fleet')

  return (
    <div className="space-y-6" style={{ animation: 'fadeInUp 0.2s ease-out both' }}>
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-[#f0f6fc]">Bot Operations</h1>
        </div>

        {/* Sub-tab nav */}
        <nav
          className="flex items-center gap-1 overflow-x-auto"
          aria-label="Bot sub-navigation"
        >
          <div className="inline-flex items-center bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
            {SUB_TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center px-4 py-1.5 text-sm font-medium whitespace-nowrap rounded-md transition-all duration-150 ${
                    isActive
                      ? 'bg-[#1f6feb] text-white shadow-sm'
                      : 'text-[#8b949e] hover:text-[#f0f6fc]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sub-tab content */}
        <div>
          {activeTab === 'fleet' && <FleetTab />}
          {activeTab === 'inventory-intel' && <InventoryIntelTab />}
          {activeTab === 'alarms' && <AlarmsTab />}
          {activeTab === 'quotes' && <QuotesTab />}
        </div>
      </div>
  )
}
