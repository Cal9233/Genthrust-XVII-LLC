'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, AlertTriangle, RefreshCw, CheckCircle2, Clock, WifiOff } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitorHealth {
  lastPollAt: string | null
  activeMailboxes: number
  totalMailboxes: number
}

interface Mailbox {
  mailboxId: string
  address: string
  lastPollAt: string | null
  lastSuccessAt: string | null
  emailsProcessed: number
  errorCount: number
  enabled: boolean
}

interface TodayStats {
  total: number
  avgScore: number | null
  extremeCount: number    // score 9-10
  urgentCount: number     // score 7-8
  importantCount: number  // score 5-6
  lowCount: number        // score 1-4
}

interface UrgentAlert {
  senderDomain: string | null
  score: number
  roMatch: string | null
  processedAt: string
}

interface EmailMonitorData {
  monitorHealth: MonitorHealth
  mailboxes: Mailbox[]
  todayStats: TodayStats
  recentUrgent: UrgentAlert[]
}

// ─── Health Computation ───────────────────────────────────────────────────────

type HealthLevel = 'healthy' | 'warning' | 'critical' | 'unknown'

function computeHealth(lastPollAt: string | null): HealthLevel {
  if (!lastPollAt) return 'unknown'
  const ageMs = Date.now() - new Date(lastPollAt).getTime()
  const ageMin = ageMs / 60_000
  if (ageMin < 10) return 'healthy'
  if (ageMin < 30) return 'warning'
  return 'critical'
}

function mailboxHealth(m: Mailbox): HealthLevel {
  if (!m.enabled) return 'unknown'
  return computeHealth(m.lastSuccessAt)
}

const healthConfig: Record<HealthLevel, { label: string; dot: string; badge: string; accent: string }> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-[#3fb950]',
    badge: 'bg-[#3fb950]/10 text-[#3fb950]',
    accent: '#3fb950',
  },
  warning: {
    label: 'Warning',
    dot: 'bg-[#d29922]',
    badge: 'bg-[#d29922]/10 text-[#d29922]',
    accent: '#d29922',
  },
  critical: {
    label: 'Stale',
    dot: 'bg-[#f85149]',
    badge: 'bg-[#f85149]/10 text-[#f85149]',
    accent: '#f85149',
  },
  unknown: {
    label: 'No Data',
    dot: 'bg-[#8b949e]',
    badge: 'bg-[#8b949e]/10 text-[#8b949e]',
    accent: '#8b949e',
  },
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const ageMs = Date.now() - new Date(iso).getTime()
  const ageMin = Math.floor(ageMs / 60_000)
  if (ageMin < 1) return 'just now'
  if (ageMin < 60) return `${ageMin}m ago`
  const ageHr = Math.floor(ageMin / 60)
  if (ageHr < 24) return `${ageHr}h ago`
  return `${Math.floor(ageHr / 24)}d ago`
}

function scoreColor(score: number): string {
  if (score >= 9) return 'text-[#f85149]'
  if (score >= 7) return 'text-[#d29922]'
  if (score >= 5) return 'text-[#58a6ff]'
  return 'text-[#8b949e]'
}

function scoreBg(score: number): string {
  if (score >= 9) return 'bg-[#f85149]/10 border-[#f85149]/20'
  if (score >= 7) return 'bg-[#d29922]/10 border-[#d29922]/20'
  if (score >= 5) return 'bg-[#58a6ff]/10 border-[#58a6ff]/20'
  return 'bg-[#8b949e]/10 border-[#8b949e]/20'
}

// ─── Score Distribution Bar ───────────────────────────────────────────────────

interface ScoreBarProps {
  label: string
  count: number
  total: number
  color: string
  textColor: string
}

function ScoreBar({ label, count, total, color, textColor }: ScoreBarProps) {
  const pct = total > 0 ? Math.max(4, (count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className={`text-[10px] font-medium w-12 shrink-0 ${textColor}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: count > 0 ? `${pct}%` : '0%', backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#8b949e] w-6 text-right shrink-0">{count}</span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EmailCardSkeleton() {
  return (
    <div className="relative bg-[#161b22] border border-white/[0.06] rounded-lg p-5 overflow-hidden animate-pulse">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/[0.06] rounded-l-lg" />
      <div className="pl-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-white/[0.06]" />
            <div className="h-4 w-36 bg-white/[0.06] rounded" />
          </div>
          <div className="h-5 w-16 bg-white/[0.06] rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-2.5 w-14 bg-white/[0.06] rounded mb-1.5" />
              <div className="h-6 w-10 bg-white/[0.06] rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-full bg-white/[0.06] rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmailIntelligenceCard() {
  const [data, setData] = useState<EmailMonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setError(null)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10_000)
      const res = await fetch('/api/internal/email/monitor', { signal: controller.signal })
        .finally(() => clearTimeout(timer))

      if (!res.ok) {
        if (res.status === 401) throw new Error('Unauthorized')
        throw new Error(`Server error ${res.status}`)
      }
      const json: EmailMonitorData = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !data) {
    return <EmailCardSkeleton />
  }

  // ── Full error state (no data yet) ────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="relative bg-[#161b22] border border-[#f85149]/30 rounded-lg p-5 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#f85149] rounded-l-lg" />
        <div className="pl-2 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-[#f85149]" />
            <span className="text-sm font-medium text-[#f0f6fc]">Email Intelligence</span>
          </div>
          <p className="text-xs text-[#8b949e]">Email monitoring unavailable</p>
          <button
            onClick={() => { setLoading(true); load() }}
            className="flex items-center gap-1.5 text-xs text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Render with data ───────────────────────────────────────────────────────
  const overallHealth = computeHealth(data?.monitorHealth.lastPollAt ?? null)
  const cfg = healthConfig[overallHealth]
  const stats = data!.todayStats
  const totalScored = stats.extremeCount + stats.urgentCount + stats.importantCount + stats.lowCount

  return (
    <div className="relative bg-[#161b22] border border-white/[0.06] rounded-lg p-5 overflow-hidden hover:bg-[#1a2233] hover:border-white/[0.10] transition-all duration-150">
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ backgroundColor: cfg.accent }}
      />

      <div className="pl-2 space-y-5">
        {/* ── Header row ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Mail className="w-5 h-5 text-[#8b949e] flex-shrink-0" />
            <h3 className="text-sm font-medium text-[#f0f6fc] truncate">Email Intelligence</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {/* Stale indicator while refreshing */}
            {loading && (
              <RefreshCw className="w-3 h-3 text-[#8b949e] animate-spin" aria-label="Refreshing" />
            )}
            {/* Health badge */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                text-[10px] font-medium uppercase tracking-wide ${cfg.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* ── Monitor health details ───────────────────────────────────────── */}
        <div className="flex items-center gap-4 text-[10px] text-[#8b949e]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last poll: {formatRelative(data?.monitorHealth.lastPollAt ?? null)}
          </span>
          {data && data.monitorHealth.totalMailboxes > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {data.monitorHealth.activeMailboxes}/{data.monitorHealth.totalMailboxes} mailboxes active
            </span>
          )}
        </div>

        {/* ── Today's stats ────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2.5">
            Last 24 Hours
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-0.5">
                Processed
              </p>
              <p className="text-xl font-mono font-semibold text-[#f0f6fc] leading-tight tabular-nums">
                {stats.total}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-0.5">
                Scored
              </p>
              <p className="text-xl font-mono font-semibold text-[#f0f6fc] leading-tight tabular-nums">
                {totalScored}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-0.5">
                Avg Score
              </p>
              <p
                className={`text-xl font-mono font-semibold leading-tight tabular-nums ${
                  stats.avgScore != null
                    ? scoreColor(Math.round(stats.avgScore))
                    : 'text-[#8b949e]'
                }`}
              >
                {stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Score Distribution ───────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2.5">
            Score Distribution
          </p>
          <div className="space-y-2">
            <ScoreBar
              label="9–10"
              count={stats.extremeCount}
              total={totalScored}
              color="#f85149"
              textColor="text-[#f85149]"
            />
            <ScoreBar
              label="7–8"
              count={stats.urgentCount}
              total={totalScored}
              color="#d29922"
              textColor="text-[#d29922]"
            />
            <ScoreBar
              label="5–6"
              count={stats.importantCount}
              total={totalScored}
              color="#58a6ff"
              textColor="text-[#58a6ff]"
            />
            <ScoreBar
              label="1–4"
              count={stats.lowCount}
              total={totalScored}
              color="#484f58"
              textColor="text-[#8b949e]"
            />
          </div>
        </div>

        {/* ── Recent Urgent Alerts ──────────────────────────────────────────── */}
        {data!.recentUrgent.length > 0 && (
          <div>
            <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2.5">
              Recent Urgent
            </p>
            <div className="space-y-1.5">
              {data!.recentUrgent.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded px-2.5 py-1.5 border text-xs
                    ${scoreBg(alert.score)}`}
                >
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 text-[#d29922]" aria-hidden />
                  <span className="font-mono text-[#f0f6fc] truncate flex-1 min-w-0">
                    {alert.senderDomain ?? 'unknown'}
                  </span>
                  {alert.roMatch && (
                    <span className="text-[10px] text-[#58a6ff] bg-[#58a6ff]/10 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                      {alert.roMatch}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold font-mono flex-shrink-0 ${scoreColor(alert.score)}`}>
                    {alert.score}
                  </span>
                  <span className="text-[10px] text-[#484f58] flex-shrink-0 hidden sm:block">
                    {formatRelative(alert.processedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Per-Mailbox Status ────────────────────────────────────────────── */}
        {data!.mailboxes.length > 0 && (
          <div>
            <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2.5">
              Mailboxes
            </p>
            <div className="space-y-1.5">
              {data!.mailboxes.map((mbx) => {
                const mh = mailboxHealth(mbx)
                const mc = healthConfig[mh]
                return (
                  <div
                    key={mbx.mailboxId}
                    className="flex items-center gap-2.5 text-xs"
                    aria-label={`${mbx.address}: ${mc.label}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mc.dot}`} />
                    <span className="text-[#f0f6fc] truncate flex-1 min-w-0 font-mono text-[11px]">
                      {mbx.address}
                    </span>
                    {!mbx.enabled && (
                      <span className="text-[9px] font-medium text-[#8b949e] bg-white/[0.06] px-1.5 py-0.5 rounded flex-shrink-0">
                        DISABLED
                      </span>
                    )}
                    <span className="text-[10px] text-[#484f58] flex-shrink-0">
                      {formatRelative(mbx.lastSuccessAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── No-data placeholder (tables not yet created) ──────────────────── */}
        {data!.mailboxes.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-[#8b949e]">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>No mailboxes configured — monitoring will start after setup</span>
          </div>
        )}

        {/* ── Footer: last refresh ──────────────────────────────────────────── */}
        <p className="text-[10px] text-[#484f58] font-mono tabular-nums">
          refreshed {lastRefresh.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
