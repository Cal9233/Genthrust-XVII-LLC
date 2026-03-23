'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  Send,
  FileText,
  Zap,
  Database,
  PackageCheck,
  CalendarClock,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { ChartCard } from '@/components/internal/ChartCard'
import { StatusBadge } from '@/components/internal/StatusBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AutomationData {
  emailMonitor: {
    lastRun: string | null
    processedToday: number
    queuedCount: number
    status: 'active' | 'idle' | 'error'
  }
  syncStatus: {
    lastSync: string | null
    partsCount: number
    status: 'synced' | 'stale' | 'error'
  }
  overdue: {
    count: number
    dueSoonCount: number
  }
}

interface SyncResult {
  success: boolean
  message: string
  count?: number
  mode?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTs(val: string | null): string {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function relativeTime(val: string | null): string {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

function emailStatusToVariant(status: 'active' | 'idle' | 'error') {
  if (status === 'active') return 'success' as const
  if (status === 'error') return 'error' as const
  return 'neutral' as const
}

function syncStatusToVariant(status: 'synced' | 'stale' | 'error') {
  if (status === 'synced') return 'success' as const
  if (status === 'error') return 'error' as const
  return 'warning' as const
}

// ── Quick Action Button ────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ElementType
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger'
}

function ActionBtn({ icon: Icon, label, onClick, loading, disabled, variant = 'default' }: ActionBtnProps) {
  const colorMap = {
    default: 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border-white/[0.08]',
    primary: 'text-[#58a6ff] hover:text-white hover:bg-[#1f6feb] border-[#1f6feb]/30',
    danger: 'text-[#f85149] hover:text-white hover:bg-[#f85149] border-[#f85149]/30',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${colorMap[variant]}`}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      {label}
    </button>
  )
}

// ── Sync Result Toast ──────────────────────────────────────────────────────────

function SyncResultBanner({ result, onDismiss }: { result: SyncResult; onDismiss: () => void }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
        result.success
          ? 'bg-[#3fb950]/10 border-[#3fb950]/20 text-[#3fb950]'
          : 'bg-[#f85149]/10 border-[#f85149]/20 text-[#f85149]'
      }`}
      role="status"
      aria-live="polite"
    >
      {result.success ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium">{result.message}</p>
        {result.success && result.count != null && (
          <p className="text-[11px] opacity-80 mt-0.5">
            {result.count.toLocaleString()} parts · {result.mode ?? 'incremental'} mode
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-inherit opacity-60 hover:opacity-100 transition-opacity text-xs font-medium ml-2"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [data, setData] = useState<AutomationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  // Action states
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [emailActionBusy, setEmailActionBusy] = useState(false)
  const [emailActionMsg, setEmailActionMsg] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/automation')
      if (!res.ok) throw new Error('Failed to load automation data')
      const json: AutomationData = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
    setVisible(false)
  }, [loading])

  async function handleSyncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/internal/sync/parts', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) {
        setSyncResult({ success: false, message: json.details ?? 'Sync already in progress' })
      } else if (!res.ok) {
        setSyncResult({ success: false, message: json.details ?? 'Parts sync failed' })
      } else {
        setSyncResult({ success: true, message: json.message ?? 'Sync complete', count: json.count, mode: json.mode })
        // Refresh stats after a short delay so DB reflects new data
        setTimeout(loadData, 1500)
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error — sync request failed' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleTriggerPoll() {
    setEmailActionBusy(true)
    setEmailActionMsg(null)
    try {
      const res = await fetch('/api/internal/email/monitor')
      if (!res.ok) throw new Error('Monitor check failed')
      setEmailActionMsg('Monitor status refreshed')
      await loadData()
    } catch {
      setEmailActionMsg('Could not reach email monitor')
    } finally {
      setEmailActionBusy(false)
      setTimeout(() => setEmailActionMsg(null), 4000)
    }
  }

  // Full-page error state (no data yet)
  if (error && !data && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f85149]/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[#f85149]" />
          </div>
          <p className="text-[#f85149] font-semibold text-lg mb-1">Unable to load automation data</p>
          <p className="text-[#8b949e] text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1f6feb] rounded-lg hover:bg-[#388bfd] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  const em = data?.emailMonitor
  const sync = data?.syncStatus
  const ov = data?.overdue

  return (
    <div className="space-y-6" style={{ animation: 'fadeInUp 0.2s ease-out both' }}>

      {/* ── Header ── */}
      <div
        className={`flex items-center justify-between transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold text-[#f0f6fc]">Automation</h1>
          <p className="text-[#8b949e] mt-0.5 text-sm">
            Email monitor, ERP sync triggers, and payment monitoring.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          aria-label="Refresh automation data"
          className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Inline error banner (data already loaded) ── */}
      {error && data && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20">
          <AlertCircle className="w-4 h-4 text-[#f85149] flex-shrink-0" />
          <p className="text-sm font-medium text-[#f85149] flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-[#f85149] hover:text-[#ff7b72] font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION A — Email Automation
          ════════════════════════════════════════════════════════════════ */}
      <div
        className={`space-y-4 transition-all duration-500 delay-75 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* Section label */}
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-[#484f58]" />
          <span className="text-[0.6875rem] font-bold text-[#484f58] uppercase tracking-widest">
            Email Automation
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Status"
            value={em?.status ?? '—'}
            color="blue"
            subtitle={em?.status === 'active' ? 'Polling actively' : em?.status === 'error' ? 'Check mailbox config' : 'No recent activity'}
            loading={loading}
          />
          <StatCard
            icon={CheckCircle2}
            label="Processed Today"
            value={em?.processedToday ?? 0}
            color="green"
            subtitle="Rolling 24 hours"
            loading={loading}
          />
          <StatCard
            icon={Inbox}
            label="Queued (1h)"
            value={em?.queuedCount ?? 0}
            color="orange"
            subtitle="Pending processing"
            loading={loading}
          />
          <StatCard
            icon={Clock}
            label="Last Poll"
            value={relativeTime(em?.lastRun ?? null)}
            color="indigo"
            subtitle={formatTs(em?.lastRun ?? null)}
            loading={loading}
          />
        </div>

        {/* Email actions card */}
        <ChartCard
          title="Email Actions"
          icon={Mail}
          iconColor="text-[#58a6ff]"
          subtitle="Manage the inbox automation pipeline"
          padded
          action={
            em && !loading ? (
              <StatusBadge
                status={em.status}
                variant={emailStatusToVariant(em.status)}
                label={em.status.charAt(0).toUpperCase() + em.status.slice(1)}
              />
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActionBtn
                icon={Send}
                label="Send Test Email"
                variant="primary"
                onClick={() => window.open('/internal/bots', '_self')}
              />
              <ActionBtn
                icon={FileText}
                label="View Email Thread"
                onClick={() => window.open('/api/internal/email/thread', '_blank')}
              />
              <ActionBtn
                icon={RefreshCw}
                label="Trigger Poll"
                variant="primary"
                loading={emailActionBusy}
                onClick={handleTriggerPoll}
              />
            </div>

            {emailActionMsg && (
              <p className="text-xs text-[#8b949e]" role="status" aria-live="polite">
                {emailActionMsg}
              </p>
            )}

            <div className="border-t border-white/[0.05] pt-4">
              <p className="text-[11px] font-semibold text-[#484f58] uppercase tracking-widest mb-2">
                Monitor Details
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                <div>
                  <dt className="text-[#484f58] mb-0.5">Last run</dt>
                  <dd className="text-[#f0f6fc] font-medium">{formatTs(em?.lastRun ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-[#484f58] mb-0.5">Processed today</dt>
                  <dd className="text-[#f0f6fc] font-medium">{(em?.processedToday ?? 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[#484f58] mb-0.5">Queued</dt>
                  <dd className="text-[#f0f6fc] font-medium">{(em?.queuedCount ?? 0).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION B — ERP Sync
          ════════════════════════════════════════════════════════════════ */}
      <div
        className={`space-y-4 transition-all duration-500 delay-150 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#484f58]" />
          <span className="text-[0.6875rem] font-bold text-[#484f58] uppercase tracking-widest">
            ERP Sync
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={PackageCheck}
            label="Synced Parts"
            value={sync?.partsCount ?? 0}
            color="green"
            subtitle="Total in parts DB"
            loading={loading}
          />
          <StatCard
            icon={Clock}
            label="Last Sync"
            value={relativeTime(sync?.lastSync ?? null)}
            color="blue"
            subtitle={formatTs(sync?.lastSync ?? null)}
            loading={loading}
          />
          <StatCard
            icon={Zap}
            label="Sync Status"
            value={sync?.status ?? '—'}
            color={sync?.status === 'synced' ? 'green' : sync?.status === 'stale' ? 'orange' : 'red'}
            subtitle={
              sync?.status === 'synced'
                ? 'Up to date'
                : sync?.status === 'stale'
                ? 'Data may be outdated'
                : 'Cannot determine sync state'
            }
            loading={loading}
          />
        </div>

        <ChartCard
          title="ERP Sync Control"
          icon={Database}
          iconColor="text-[#3fb950]"
          subtitle="Trigger incremental or full parts sync from AERO"
          padded
          action={
            sync && !loading ? (
              <StatusBadge
                status={sync.status}
                variant={syncStatusToVariant(sync.status)}
                label={sync.status.charAt(0).toUpperCase() + sync.status.slice(1)}
              />
            ) : undefined
          }
        >
          <div className="space-y-4">
            {syncResult && (
              <SyncResultBanner result={syncResult} onDismiss={() => setSyncResult(null)} />
            )}

            <div className="flex flex-wrap gap-2">
              <ActionBtn
                icon={RefreshCw}
                label="Sync Now (Incremental)"
                variant="primary"
                loading={syncing}
                disabled={syncing}
                onClick={handleSyncNow}
              />
              <ActionBtn
                icon={Database}
                label="Full Sync"
                variant="default"
                loading={syncing}
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true)
                  setSyncResult(null)
                  try {
                    const res = await fetch('/api/internal/sync/parts?full=true', { method: 'POST' })
                    const json = await res.json()
                    if (res.status === 409) {
                      setSyncResult({ success: false, message: json.details ?? 'Sync already in progress' })
                    } else if (!res.ok) {
                      setSyncResult({ success: false, message: json.details ?? 'Parts sync failed' })
                    } else {
                      setSyncResult({ success: true, message: json.message ?? 'Full sync complete', count: json.count, mode: json.mode })
                      setTimeout(loadData, 1500)
                    }
                  } catch {
                    setSyncResult({ success: false, message: 'Network error — sync request failed' })
                  } finally {
                    setSyncing(false)
                  }
                }}
              />
            </div>

            <div className="border-t border-white/[0.05] pt-4">
              <p className="text-[11px] font-semibold text-[#484f58] uppercase tracking-widest mb-2">
                Sync Details
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                <div>
                  <dt className="text-[#484f58] mb-0.5">Last sync</dt>
                  <dd className="text-[#f0f6fc] font-medium">{formatTs(sync?.lastSync ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-[#484f58] mb-0.5">Parts in DB</dt>
                  <dd className="text-[#f0f6fc] font-medium">{(sync?.partsCount ?? 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-[#484f58] mb-0.5">Mode</dt>
                  <dd className="text-[#f0f6fc] font-medium">Incremental / Full</dd>
                </div>
              </dl>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION C — Payment Monitoring
          ════════════════════════════════════════════════════════════════ */}
      <div
        className={`space-y-4 transition-all duration-500 delay-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="w-3.5 h-3.5 text-[#484f58]" />
          <span className="text-[0.6875rem] font-bold text-[#484f58] uppercase tracking-widest">
            Payment Monitoring
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={AlertTriangle}
            label="Overdue ROs"
            value={ov?.count ?? 0}
            color="red"
            subtitle="Past due date, still open"
            loading={loading}
          />
          <StatCard
            icon={CalendarClock}
            label="Due Within 7 Days"
            value={ov?.dueSoonCount ?? 0}
            color="orange"
            subtitle="Upcoming due dates"
            loading={loading}
          />
        </div>

        <ChartCard
          title="Repair Order Due Dates"
          icon={CalendarClock}
          iconColor="text-[#d29922]"
          subtitle="Open repair orders approaching or past their due date"
          padded
        >
          <div className="space-y-4">
            {/* Status summary tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Overdue tile */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#f85149]/[0.06] border border-[#f85149]/[0.15]">
                <div className="w-9 h-9 rounded-lg bg-[#f85149]/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[#f85149]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold font-mono text-[#f85149] tabular-nums leading-none">
                    {loading ? '—' : (ov?.count ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-[#f85149] mt-1">Overdue</p>
                  <p className="text-[11px] text-[#8b949e] mt-0.5 leading-snug">
                    Open ROs past their due date
                  </p>
                  <a
                    href="/internal/erp?status=active&overdue=true"
                    className="inline-flex items-center gap-1 text-[11px] text-[#f85149] hover:underline mt-2 font-medium"
                  >
                    View in ERP →
                  </a>
                </div>
              </div>

              {/* Due soon tile */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-[#d29922]/[0.06] border border-[#d29922]/[0.15]">
                <div className="w-9 h-9 rounded-lg bg-[#d29922]/10 flex items-center justify-center flex-shrink-0">
                  <CalendarClock className="w-4 h-4 text-[#d29922]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold font-mono text-[#d29922] tabular-nums leading-none">
                    {loading ? '—' : (ov?.dueSoonCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-[#d29922] mt-1">Due Soon</p>
                  <p className="text-[11px] text-[#8b949e] mt-0.5 leading-snug">
                    Within the next 7 days
                  </p>
                  <a
                    href="/internal/erp?status=active&due_soon=true"
                    className="inline-flex items-center gap-1 text-[11px] text-[#d29922] hover:underline mt-2 font-medium"
                  >
                    View in ERP →
                  </a>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#484f58] leading-relaxed">
              Counts reflect open repair orders only (excludes Closed, Cancelled, and Completed).
              Use the ERP tab for full filtering and detail views.
            </p>
          </div>
        </ChartCard>
      </div>

    </div>
  )
}
