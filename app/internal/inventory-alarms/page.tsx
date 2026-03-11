'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, AlertCircle, Bell, Search, Shield,
  AlertTriangle, Eye, Package, CheckCircle, Trash2, Plus
} from 'lucide-react'

interface SummaryData {
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

interface DashboardData {
  summary: SummaryData
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

function formatDate(val: string | null) {
  if (!val) return '\u2014'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '\u2014'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
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

function ConditionBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NE: 'bg-green-100 text-green-700',
    OH: 'bg-blue-100 text-blue-700',
    SV: 'bg-purple-100 text-purple-700',
    AR: 'bg-orange-100 text-orange-700',
  }
  const c = colors[condition] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c}`}>
      {condition}
    </span>
  )
}

function AlarmTypeBadge({ type }: { type: string }) {
  const t = type?.toUpperCase() || ''
  if (t.includes('OH'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">OH Depleted</span>
  if (t.includes('AR'))
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">AR Depleted</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">{type}</span>
}

function QtyIndicator({ qty }: { qty: number }) {
  if (qty === 0) return <span className="inline-flex items-center gap-1 text-red-600 font-bold"><AlertTriangle className="w-3 h-3" /> 0</span>
  return <span className="text-green-600 font-bold">{qty}</span>
}

export default function InventoryAlarmsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Check state
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ErpPart[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Inline action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/inventory-alarms')
      if (!res.ok) throw new Error('Failed to load alarm data')
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  async function runCheck() {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await fetch('/api/internal/inventory-alarms/check', { method: 'POST' })
      if (!res.ok) throw new Error('Check failed')
      const result = await res.json()
      setCheckResult(result)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  async function acknowledgeAlarm(alertId: number) {
    setActionLoading(`ack-${alertId}`)
    try {
      const res = await fetch('/api/internal/inventory-alarms/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      })
      if (res.ok) await loadData()
    } finally {
      setActionLoading(null)
    }
  }

  async function removeFromWatchlist(id: number) {
    setActionLoading(`rm-${id}`)
    try {
      const res = await fetch('/api/internal/inventory-alarms/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) await loadData()
    } finally {
      setActionLoading(null)
    }
  }

  async function addToWatchlist(part: ErpPart) {
    if (!part.condition) return
    setActionLoading(`add-${part.part_number}-${part.condition}`)
    try {
      const res = await fetch('/api/internal/inventory-alarms/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: part.part_number,
          condition_code: part.condition,
          description: part.description || null,
        }),
      })
      if (res.ok) await loadData()
    } finally {
      setActionLoading(null)
    }
  }

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ q })
      const res = await fetch(`/api/internal/inventory-alarms/search?${params}`)
      if (res.ok) {
        const json = await res.json()
        setSearchResults(json.parts || [])
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => performSearch(searchQuery), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, performSearch])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading inventory alarms...</span>
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

  const summary = data?.summary
  const unacknowledgedAlarms = data?.recentAlarms?.filter(a => !a.acknowledged_at) || []
  const acknowledgedAlarms = data?.recentAlarms?.filter(a => a.acknowledged_at) || []
  const watchedPartKeys = new Set(data?.watchlist?.map(w => `${w.part_number}|${w.condition_code}`) || [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">Inventory Alarms</h1>
          <p className="text-slate-500 mt-1 text-sm">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runCheck}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Shield className={`w-4 h-4 ${checking ? 'animate-pulse' : ''}`} />
            {checking ? 'Checking...' : 'Check Now'}
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Check Result Banner */}
      {checkResult && (
        <div className={`rounded-xl border p-4 ${checkResult.alarms_triggered > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2">
            {checkResult.alarms_triggered > 0 ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            <span className={`font-medium ${checkResult.alarms_triggered > 0 ? 'text-red-700' : 'text-green-700'}`}>
              Checked {checkResult.checked} parts — {checkResult.alarms_triggered} alarm{checkResult.alarms_triggered !== 1 ? 's' : ''} triggered
            </span>
          </div>
          {checkResult.alarms.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checkResult.alarms.map((a, i) => (
                <li key={i} className="text-sm text-red-600">
                  {a.part_number} ({a.condition_code}): qty dropped from {a.previous_qty} to {a.current_qty}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setCheckResult(null)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Eye} label="Watched Parts" value={summary?.watchedParts || 0} color="blue" />
        <StatCard icon={Bell} label="Active Alarms" value={summary?.activeAlarms || 0} color={summary?.activeAlarms ? 'red' : 'green'} />
        <StatCard icon={Package} label="OH Watched" value={summary?.ohWatched || 0} color="blue" />
        <StatCard icon={Package} label="AR Watched" value={summary?.arWatched || 0} color="orange" />
      </div>

      {/* Active Alarms Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="font-bold text-navy-900">Active Alarms</h2>
          {unacknowledgedAlarms.length > 0 && (
            <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              {unacknowledgedAlarms.length} unacknowledged
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Time</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unacknowledgedAlarms.map((alarm) => (
                <tr key={alarm.id} className="hover:bg-red-50/50 transition-colors">
                  <td className="px-4 py-3"><AlarmTypeBadge type={alarm.alert_type} /></td>
                  <td className="px-4 py-3 font-medium text-navy-900">{alarm.part_number}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[300px]">{alarm.details}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(alarm.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                      Unacknowledged
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => acknowledgeAlarm(alarm.id)}
                      disabled={actionLoading === `ack-${alarm.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      {actionLoading === `ack-${alarm.id}` ? 'Ack...' : 'Acknowledge'}
                    </button>
                  </td>
                </tr>
              ))}
              {acknowledgedAlarms.slice(0, 10).map((alarm) => (
                <tr key={alarm.id} className="hover:bg-slate-50 transition-colors opacity-60">
                  <td className="px-4 py-3"><AlarmTypeBadge type={alarm.alert_type} /></td>
                  <td className="px-4 py-3 font-medium text-navy-900">{alarm.part_number}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[300px]">{alarm.details}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(alarm.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                      Ack by {alarm.acknowledged_by}
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))}
              {(data?.recentAlarms?.length || 0) === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No alarms</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-navy-900">Watchlist</h2>
          <span className="ml-auto text-xs text-slate-400">{data?.watchlist?.length || 0} parts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Condition</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Last Qty</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Last Checked</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Added By</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.watchlist?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{item.part_number}</td>
                  <td className="px-4 py-3"><ConditionBadge condition={item.condition_code} /></td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{item.description || '\u2014'}</td>
                  <td className="px-4 py-3 text-right"><QtyIndicator qty={item.last_known_qty} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(item.last_checked_at)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.added_by}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeFromWatchlist(item.id)}
                      disabled={actionLoading === `rm-${item.id}`}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {actionLoading === `rm-${item.id}` ? '...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
              {(!data?.watchlist || data.watchlist.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No parts being watched</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add to Watchlist - ERP Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-green-500" />
          <h2 className="font-bold text-navy-900">Add to Watchlist</h2>
        </div>
        <div className="p-5">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ERP parts by part number..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {searchLoading && (
            <div className="text-center py-4 text-slate-400 text-sm">Searching ERP...</div>
          )}

          {searchResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Condition</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Qty</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Price</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Warehouse</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchResults.map((part, i) => {
                    const isWatched = watchedPartKeys.has(`${part.part_number}|${part.condition}`)
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-navy-900">{part.part_number}</td>
                        <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{part.description || '\u2014'}</td>
                        <td className="px-4 py-3">{part.condition ? <ConditionBadge condition={part.condition} /> : '\u2014'}</td>
                        <td className="px-4 py-3 text-right"><QtyIndicator qty={part.quantity} /></td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(part.unit_price)}</td>
                        <td className="px-4 py-3 text-slate-600">{part.warehouse || '\u2014'}</td>
                        <td className="px-4 py-3">
                          {part.condition ? (
                            isWatched ? (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Watching
                              </span>
                            ) : (
                              <button
                                onClick={() => addToWatchlist(part)}
                                disabled={actionLoading === `add-${part.part_number}-${part.condition}`}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                              >
                                <Plus className="w-3 h-3" />
                                {actionLoading === `add-${part.part_number}-${part.condition}` ? 'Adding...' : 'Watch'}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">No condition</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2 px-4">{searchResults.length} results from ERP</p>
            </div>
          )}

          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No ERP results for &ldquo;{searchQuery}&rdquo;</div>
          )}
        </div>
      </div>
    </div>
  )
}
