'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw, AlertCircle, Bot, Activity, MessageSquare,
  Terminal, RotateCcw, ChevronDown
} from 'lucide-react'

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

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'RUNNING'
    ? 'bg-green-500 shadow-green-500/50'
    : status === 'STOPPED'
      ? 'bg-red-500 shadow-red-500/50'
      : 'bg-yellow-500 shadow-yellow-500/50'
  return <div className={`w-3 h-3 rounded-full ${color} shadow-lg`} />
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[severity] || colors.info}`}>
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
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[name] || 'bg-slate-100 text-slate-600'}`}>
      {name.toUpperCase()}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number | string; color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-extrabold text-navy-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  )
}

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

  useEffect(() => { loadData() }, [])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load logs when bot changes
  useEffect(() => { loadLogs(selectedBot) }, [selectedBot])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading bot operations...</span>
        </div>
      </div>
    )
  }

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

  // Aggregate metrics for stat cards
  const allMetrics = data?.metrics || {}
  const quotesToday = allMetrics.ils?.['Quotes Created'] || 0
  const reportsSent = allMetrics.internal?.['8130 Reports'] || 0
  const aogLeads = allMetrics.aog?.['AOG Leads'] || 0
  const inventoryAlerts = allMetrics.inventory?.['Alerts Sent'] || 0
  const syncsCompleted = allMetrics.sync?.['Files Synced'] || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">Bot Operations</h1>
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

      {/* Bot Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {data?.statuses.map((bot) => {
          const metrics = allMetrics[bot.key] || {}
          const primaryMetric = Object.entries(metrics)[0]
          return (
            <div key={bot.key} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <StatusDot status={bot.status} />
                <span className="text-xs font-bold uppercase text-slate-400">{bot.status}</span>
              </div>
              <h3 className="font-bold text-navy-900 text-sm">{bot.displayName}</h3>
              <p className="text-xs text-slate-500 mt-1">{bot.description}</p>
              {primaryMetric && (
                <p className="text-xs text-slate-600 mt-2 font-medium">
                  {primaryMetric[0]}: <span className="text-navy-900 font-bold">{primaryMetric[1]}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Key Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={MessageSquare} label="Quotes Today" value={quotesToday} color="purple" />
        <StatCard icon={Activity} label="Reports Sent" value={reportsSent} color="blue" />
        <StatCard icon={AlertCircle} label="AOG Leads" value={aogLeads} color="red" />
        <StatCard icon={Bot} label="Inventory Alerts" value={inventoryAlerts} color="orange" />
        <StatCard icon={RefreshCw} label="Syncs Done" value={syncsCompleted} color="teal" />
      </div>

      {/* Inventory Quick Stats */}
      {inventory && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Pending Drafts" value={inventory.pendingDrafts} color="purple" />
          <StatCard icon={Activity} label="Committed Stock" value={inventory.committedStock} color="green" />
          <StatCard icon={Bot} label="Total SKUs" value={inventory.totalSkus} color="blue" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium mb-2">Condition Breakdown</p>
            <div className="flex flex-wrap gap-1">
              {inventory.conditionBreakdown.map((c) => (
                <span key={c.condition} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {c.condition || 'N/A'}: {c.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Two Columns: Notifications + Log Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Feed */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <h2 className="font-bold text-navy-900">Notification Feed</h2>
            <span className="text-xs text-slate-400 ml-auto">{data?.notifications.length || 0} events</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
            {data?.notifications.map((n, i) => (
              <div key={i} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-slate-400 font-mono">{formatDate(n.timestamp)}</span>
                  <BotBadge name={n.bot} />
                  <SeverityBadge severity={n.severity} />
                </div>
                <p className="text-xs text-slate-600 truncate">{n.event}</p>
              </div>
            ))}
            {(!data?.notifications || data.notifications.length === 0) && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No notifications today</div>
            )}
          </div>
        </div>

        {/* Log Viewer */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-500" />
            <h2 className="font-bold text-navy-900">Bot Log Viewer</h2>
            <div className="ml-auto relative">
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 appearance-none pr-7 cursor-pointer"
              >
                {data?.statuses.map((bot) => (
                  <option key={bot.key} value={bot.key}>{bot.displayName}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto bg-slate-900 p-4">
            {logLoading ? (
              <div className="text-slate-400 text-xs text-center py-4">Loading logs...</div>
            ) : (
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {logContent || 'No log content available'}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Restart Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-4 h-4 text-orange-500" />
          <h2 className="font-bold text-navy-900">Service Controls</h2>
        </div>
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
              <RotateCcw className={`w-3.5 h-3.5 ${restartingBot === bot.key ? 'animate-spin' : ''}`} />
              Restart {bot.displayName}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
