'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  RefreshCw, AlertCircle, Bot, Activity, MessageSquare,
  Terminal, RotateCcw, ChevronDown, Package, Layers, Cpu
} from 'lucide-react'
import { LineChart, Line } from 'recharts'
import { StatCard, StatCardSkeleton } from '@/components/internal/StatCard'
import { StatusDot } from '@/components/internal/DataTable'
import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface InventoryData {
  pendingDrafts: number
  committedStock: number
  totalSkus: number
  conditionBreakdown: { condition: string; count: number; qty: number }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(val: string | null) {
  if (!val) return '\u2014'
  return new Date(val).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

/** Deterministic-ish sparkline data seeded by bot key */
function generateSparkline(seed: string): { v: number }[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Array.from({ length: 12 }, (_, i) => {
    hash = ((hash << 5) - hash + i) | 0
    return { v: Math.abs(hash) % 10 }
  })
}

/** Wrap a log line with basic syntax-highlighted spans */
function highlightLogLine(line: string): React.ReactNode {
  // Timestamp pattern e.g. 2025-03-10T14:22:01 or [14:22:01]
  const parts: React.ReactNode[] = []
  const timestampRe = /^(\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*\]?|\[\d{2}:\d{2}:\d{2}\])/
  const tsMatch = line.match(timestampRe)
  let rest = line

  if (tsMatch) {
    parts.push(
      <span key="ts" className="text-slate-500">{tsMatch[0]}</span>
    )
    rest = line.slice(tsMatch[0].length)
  }

  // Keyword highlighting
  const keywordRe = /\b(ERROR|FATAL|EXCEPTION)\b/g
  const warnRe = /\b(WARNING|WARN)\b/g
  const successRe = /\b(SUCCESS|OK|COMPLETED)\b/g

  if (keywordRe.test(rest)) {
    parts.push(
      <span key="body" className="text-red-400">
        {rest}
      </span>
    )
  } else if (warnRe.test(rest)) {
    parts.push(
      <span key="body" className="text-yellow-400">
        {rest}
      </span>
    )
  } else if (successRe.test(rest)) {
    parts.push(
      <span key="body" className="text-green-400">
        {rest}
      </span>
    )
  } else {
    parts.push(
      <span key="body" className="text-slate-300">
        {rest}
      </span>
    )
  }

  return <>{parts}</>
}

// ---------------------------------------------------------------------------
// Page-specific inline components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
        colors[severity] || colors.info
      }`}
    >
      {severity}
    </span>
  )
}

function BotBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    ils: 'bg-purple-100 text-purple-700',
    internal: 'bg-blue-100 text-blue-700',
    sync: 'bg-teal-100 text-teal-700',
    aog: 'bg-red-100 text-red-700',
    inventory: 'bg-orange-100 text-orange-700',
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
        colors[name] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {name.toUpperCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton layout shown while initial load is in-flight
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-72 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-24 bg-slate-200 rounded-lg" />
      </div>

      {/* Bot cards skeleton */}
      <div>
        <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                <div className="h-3 w-16 bg-slate-200 rounded" />
              </div>
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
              <div className="h-[30px] w-[80px] bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div>
        <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Inventory skeleton */}
      <div>
        <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Bottom panels skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Notification Feed" loading />
        <ChartCard title="Bot Log Viewer" loading />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Staggered fade-in wrapper
// ---------------------------------------------------------------------------

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="animate-[fadeSlideIn_0.45s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function BotsPage() {
  const [data, setData] = useState<BotDashboardData | null>(null)
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Log viewer state
  const [selectedBot, setSelectedBot] = useState('ils')
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)

  // Restart state
  const [restartingBot, setRestartingBot] = useState<string | null>(null)
  const [restartResult, setRestartResult] = useState<string | null>(null)

  // ------ Data loaders (preserved) ------

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [botsRes, invRes] = await Promise.all([
        fetch('/api/internal/bots'),
        fetch('/api/internal/bots/inventory'),
      ])
      if (!botsRes.ok) throw new Error('Failed to load bot data')
      const botsJson = await botsRes.json()
      setData(botsJson)

      if (invRes.ok) {
        setInventory(await invRes.json())
      }
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function loadLogs(botKey: string) {
    setLogLoading(true)
    try {
      const res = await fetch(`/api/internal/bots/logs?bot=${botKey}&lines=100`)
      if (res.ok) {
        const json = await res.json()
        setLogContent(json.content || 'No log content')
      }
    } catch {
      setLogContent('Failed to load logs')
    } finally {
      setLogLoading(false)
    }
  }

  async function restartBot(botKey: string) {
    if (!confirm(`Are you sure you want to restart ${botKey.toUpperCase()}?`)) return
    setRestartingBot(botKey)
    setRestartResult(null)
    try {
      const res = await fetch('/api/internal/bots/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botName: botKey, confirm: true }),
      })
      const json = await res.json()
      setRestartResult(json.message || (json.success ? 'Restarted' : 'Failed'))
      if (json.success) loadData()
    } catch (err) {
      setRestartResult('Restart request failed')
    } finally {
      setRestartingBot(null)
    }
  }

  // ------ Effects (preserved) ------

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { loadLogs(selectedBot) }, [selectedBot])

  // ------ Derived metrics ------

  const allMetrics = data?.metrics || {}
  const quotesToday = allMetrics.ils?.['Quotes Created'] || 0
  const reportsSent = allMetrics.internal?.['8130 Reports'] || 0
  const aogLeads = allMetrics.aog?.['AOG Leads'] || 0
  const inventoryAlerts = allMetrics.inventory?.['Alerts Sent'] || 0
  const syncsCompleted = allMetrics.sync?.['Files Synced'] || 0

  // Memoize sparkline data so it stays stable across renders
  const sparklines = useMemo(() => {
    const map: Record<string, { v: number }[]> = {}
    data?.statuses.forEach((bot) => {
      map[bot.key] = generateSparkline(bot.key)
    })
    return map
  }, [data?.statuses])

  // Highlighted log lines (memoised to avoid recompute on every render)
  const highlightedLog = useMemo(() => {
    if (!logContent) return null
    return logContent.split('\n').map((line, idx) => (
      <div key={idx} className="leading-relaxed">
        {highlightLogLine(line)}
      </div>
    ))
  }, [logContent])

  // ------ Loading / Error states ------

  if (loading && !data) {
    return <PageSkeleton />
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ------ Render ------

  return (
    <>
      {/* Inject keyframes for fade-in animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,.6); }
          50%       { opacity: .85; box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }
      `}</style>

      <div className="space-y-8">
        {/* ============================================================
            HEADER
        ============================================================ */}
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">Bot Operations</h1>
              <p className="text-slate-500 mt-1 text-sm">
                Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 30s)
              </p>
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

        {/* ============================================================
            BOT STATUS CARDS
        ============================================================ */}
        <FadeIn delay={60}>
          <SectionDivider label="Bot Status" icon={Cpu} />
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {data?.statuses.map((bot, idx) => {
            const metrics = allMetrics[bot.key] || {}
            const primaryMetric = Object.entries(metrics)[0]
            const sparkData = sparklines[bot.key] || []
            const isRunning = bot.status === 'RUNNING'

            return (
              <FadeIn key={bot.key} delay={100 + idx * 80}>
                <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow duration-200">
                  {/* Status row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Pulse animation for RUNNING status dot */}
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          isRunning
                            ? 'bg-green-500'
                            : bot.status === 'STOPPED'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                        }`}
                        style={isRunning ? { animation: 'pulseDot 2s ease-in-out infinite' } : undefined}
                      />
                      <StatusDot status={bot.status} />
                    </div>
                  </div>

                  {/* Bot name & description */}
                  <h3 className="font-bold text-slate-900 text-sm">{bot.displayName}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bot.description}</p>

                  {/* Primary metric */}
                  {primaryMetric && (
                    <p className="text-xs text-slate-600 mt-2 font-medium">
                      {primaryMetric[0]}:{' '}
                      <span className="text-slate-900 font-bold">{primaryMetric[1]}</span>
                    </p>
                  )}

                  {/* Mini sparkline */}
                  <div className="mt-3">
                    <LineChart width={80} height={30} data={sparkData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={isRunning ? '#22c55e' : '#94a3b8'}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>

        {/* ============================================================
            KEY METRICS
        ============================================================ */}
        <FadeIn delay={500}>
          <SectionDivider label="Key Metrics" icon={Activity} />
        </FadeIn>

        <FadeIn delay={560}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={MessageSquare} label="Quotes Today" value={quotesToday} color="purple" />
            <StatCard icon={Activity} label="Reports Sent" value={reportsSent} color="blue" />
            <StatCard icon={AlertCircle} label="AOG Leads" value={aogLeads} color="red" />
            <StatCard icon={Bot} label="Inventory Alerts" value={inventoryAlerts} color="orange" />
            <StatCard icon={RefreshCw} label="Syncs Done" value={syncsCompleted} color="teal" />
          </div>
        </FadeIn>

        {/* ============================================================
            INVENTORY QUICK STATS
        ============================================================ */}
        {inventory && (
          <>
            <FadeIn delay={640}>
              <SectionDivider label="Inventory Snapshot" icon={Package} />
            </FadeIn>

            <FadeIn delay={700}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Layers} label="Pending Drafts" value={inventory.pendingDrafts} color="purple" />
                <StatCard icon={Activity} label="Committed Stock" value={inventory.committedStock} color="green" />
                <StatCard icon={Bot} label="Total SKUs" value={inventory.totalSkus} color="blue" />
                <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 rounded-xl border border-slate-200/60 p-4">
                  <p className="text-xs text-slate-500 font-medium mb-2">Condition Breakdown</p>
                  <div className="flex flex-wrap gap-1">
                    {inventory.conditionBreakdown.map((c) => (
                      <span
                        key={c.condition}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/70 text-slate-700 border border-slate-200"
                      >
                        {c.condition || 'N/A'}: {c.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </>
        )}

        {/* ============================================================
            NOTIFICATIONS + LOG VIEWER
        ============================================================ */}
        <FadeIn delay={780}>
          <SectionDivider label="Activity & Logs" icon={Terminal} />
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ---- Notification Feed ---- */}
          <FadeIn delay={840}>
            <ChartCard
              title="Notification Feed"
              icon={Activity}
              iconColor="text-blue-500"
              subtitle={`${data?.notifications.length || 0} events`}
            >
              <div className="max-h-[400px] overflow-y-auto -mx-5 -mb-5 divide-y divide-slate-100">
                {data?.notifications.map((n, i) => (
                  <div
                    key={i}
                    className="px-5 py-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate(n.timestamp)}
                      </span>
                      <BotBadge name={n.bot} />
                      <SeverityBadge severity={n.severity} />
                    </div>
                    <p className="text-xs text-slate-600 truncate">{n.event}</p>
                  </div>
                ))}
                {(!data?.notifications || data.notifications.length === 0) && (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">
                    No notifications today
                  </div>
                )}
              </div>
            </ChartCard>
          </FadeIn>

          {/* ---- Log Viewer ---- */}
          <FadeIn delay={900}>
            <ChartCard
              title="Bot Log Viewer"
              icon={Terminal}
              iconColor="text-green-500"
              action={
                <div className="relative">
                  <select
                    value={selectedBot}
                    onChange={(e) => setSelectedBot(e.target.value)}
                    className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 appearance-none pr-7 cursor-pointer"
                  >
                    {data?.statuses.map((bot) => (
                      <option key={bot.key} value={bot.key}>
                        {bot.displayName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              }
            >
              <div className="max-h-[400px] overflow-y-auto bg-slate-900 rounded-lg p-4 -mx-1">
                {logLoading ? (
                  <div className="text-slate-400 text-xs text-center py-4 animate-pulse">
                    Loading logs...
                  </div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {highlightedLog || (
                      <span className="text-slate-500">No log content available</span>
                    )}
                  </pre>
                )}
              </div>
            </ChartCard>
          </FadeIn>
        </div>

        {/* ============================================================
            SERVICE CONTROLS
        ============================================================ */}
        <FadeIn delay={960}>
          <SectionDivider label="Service Controls" icon={RotateCcw} />
        </FadeIn>

        <FadeIn delay={1020}>
          <ChartCard
            title="Restart Services"
            icon={RotateCcw}
            iconColor="text-orange-500"
            subtitle="Manually restart a bot service"
          >
            {restartResult && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                {restartResult}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {data?.statuses.map((bot) => (
                <button
                  key={bot.key}
                  onClick={() => restartBot(bot.key)}
                  disabled={restartingBot === bot.key}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors disabled:opacity-50"
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${restartingBot === bot.key ? 'animate-spin' : ''}`}
                  />
                  Restart {bot.displayName}
                </button>
              ))}
            </div>
          </ChartCard>
        </FadeIn>
      </div>
    </>
  )
}
