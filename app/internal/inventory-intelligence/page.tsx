'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, AlertCircle, BarChart3, Package, Search,
  AlertTriangle, TrendingUp, Clock
} from 'lucide-react'

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

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: any; label: string; value: number | string; color: string; subtitle?: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
    yellow: 'bg-yellow-50 text-yellow-600',
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
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function VelocityBadge({ tier }: { tier: string }) {
  if (tier === 'HIGH') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">HIGH</span>
  if (tier === 'MEDIUM') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">MEDIUM</span>
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
  const colors: Record<string, string> = {
    NE: 'bg-green-100 text-green-700 border-green-200',
    OH: 'bg-blue-100 text-blue-700 border-blue-200',
    SV: 'bg-purple-100 text-purple-700 border-purple-200',
    AR: 'bg-orange-100 text-orange-700 border-orange-200',
  }
  const c = colors[condition] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${c}`}>
      {condition || 'N/A'}: {count}
    </span>
  )
}

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

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const timeout = setTimeout(() => performSearch(searchQuery, searchCondition), 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchCondition, performSearch])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading inventory intelligence...</span>
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
  const syncAge = data?.syncStatus?.lastSync && data.syncStatus.lastSync !== 'Unknown'
    ? new Date(data.syncStatus.lastSync).toLocaleString()
    : 'Unknown'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">Inventory & Sales Intelligence</h1>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Package} label="Pending Drafts" value={summary?.pendingDrafts || 0} color="purple" />
        <StatCard icon={BarChart3} label="Committed Stock" value={summary?.committedStock || 0} color="green" />
        <StatCard icon={Package} label="Total SKUs" value={summary?.totalSkus || 0} color="blue" />
        <StatCard icon={AlertTriangle} label="Today's Alerts" value={summary?.todayAlerts || 0} color="yellow" />
        <StatCard
          icon={Clock}
          label="Sync Status"
          value={data?.syncStatus?.isStale ? 'STALE' : 'OK'}
          color={data?.syncStatus?.isStale ? 'red' : 'green'}
          subtitle={syncAge}
        />
        <StatCard icon={TrendingUp} label="Velocity Items" value={data?.salesVelocity?.length || 0} color="teal" />
      </div>

      {/* Condition Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-bold text-navy-900 mb-3">Condition Breakdown</h2>
        <div className="flex flex-wrap gap-2">
          {data?.conditionBreakdown.map((c) => (
            <ConditionPill key={c.condition} condition={c.condition} count={c.count} />
          ))}
          {(!data?.conditionBreakdown || data.conditionBreakdown.length === 0) && (
            <p className="text-sm text-slate-400">No condition data available</p>
          )}
        </div>
      </div>

      {/* Sales Velocity Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-500" />
          <h2 className="font-bold text-navy-900">Sales Velocity — Top Movers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">7d Sold</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">30d Sold</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">90d Sold</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">30d Revenue</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.salesVelocity?.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{item.part_number}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.sold_last_7d}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.sold_last_30d}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.sold_last_90d}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total_revenue_30d)}</td>
                  <td className="px-4 py-3"><VelocityBadge tier={item.velocity_tier} /></td>
                </tr>
              ))}
              {(!data?.salesVelocity || data.salesVelocity.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No velocity data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Alerts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <h2 className="font-bold text-navy-900">Recent Alerts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Serial</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.alerts?.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3"><AlertTypeBadge type={alert.alert_type} /></td>
                  <td className="px-4 py-3 font-medium text-navy-900">{alert.part_number}</td>
                  <td className="px-4 py-3 text-slate-600">{alert.serial_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[300px]">{alert.details}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(alert.created_at)}</td>
                </tr>
              ))}
              {(!data?.alerts || data.alerts.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No recent alerts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-navy-900">Inventory Search</h2>
        </div>
        <div className="p-5">
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

          {searchLoading && (
            <div className="text-center py-4 text-slate-400 text-sm">Searching...</div>
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
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Warehouse</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchResults.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy-900">{r.part_number}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{r.description || '—'}</td>
                      <td className="px-4 py-3"><ConditionPill condition={r.condition || ''} count={r.quantity} /></td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{r.warehouse_code || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2 px-4">{searchResults.length} results</p>
            </div>
          )}

          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No results found for "{searchQuery}"</div>
          )}
        </div>
      </div>
    </div>
  )
}
