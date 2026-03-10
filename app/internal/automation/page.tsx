'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw, AlertCircle, Zap, DollarSign, FileText,
  Wrench, ShoppingCart, ChevronDown, ChevronRight, Play
} from 'lucide-react'

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

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>
  const colors: Record<string, string> = {
    PAST_DUE: 'bg-red-100 text-red-700',
    DUE_SOON: 'bg-yellow-100 text-yellow-700',
    UPCOMING: 'bg-blue-100 text-blue-700',
    Open: 'bg-blue-100 text-blue-700',
    Active: 'bg-blue-100 text-blue-700',
    Approved: 'bg-green-100 text-green-700',
    Delivered: 'bg-purple-100 text-purple-700',
    Received: 'bg-teal-100 text-teal-700',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    Closed: 'bg-slate-100 text-slate-600',
    Completed: 'bg-green-100 text-green-700',
  }
  const colorClass = colors[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace('_', ' ')}
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
        </div>
      </div>
    </div>
  )
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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading ERP automation data...</span>
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

  const net30 = data?.net30
  const followups = data?.followups

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">ERP Automation Dashboard</h1>
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

      {/* NET30 Payment Tracking */}
      <div>
        <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          NET30 Payment Tracking
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard icon={AlertCircle} label="Past Due" value={net30?.summary.past_due || 0} color="red" />
          <StatCard icon={Zap} label="Due Soon (7d)" value={net30?.summary.due_soon || 0} color="yellow" />
          <StatCard icon={DollarSign} label="Upcoming" value={net30?.summary.upcoming || 0} color="blue" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">RO #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Vendor</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Terms</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Received</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {net30?.orders.map((order, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy-900">{order.ro_number}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{order.vendor}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3 text-slate-600">{order.payment_terms}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(order.received_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(order.payment_due_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status_flag} /></td>
                    <td className="px-4 py-3 text-right font-medium">
                      {order.days_overdue !== undefined && (
                        <span className="text-red-600">-{order.days_overdue}</span>
                      )}
                      {order.days_until_due !== undefined && (
                        <span className={order.days_until_due <= 7 ? 'text-yellow-600' : 'text-slate-600'}>
                          {order.days_until_due}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!net30?.orders || net30.orders.length === 0) && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No NET30 orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Follow-Up ROs */}
      <div>
        <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-600" />
          Follow-Up Repair Orders
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard icon={FileText} label="Approved" value={followups?.statuses.Approved || 0} color="green" />
          <StatCard icon={ShoppingCart} label="Delivered" value={followups?.statuses.Delivered || 0} color="purple" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">RO #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Vendor</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followups?.orders.map((ro, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy-900">{ro.ro_number}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{ro.vendor}</td>
                    <td className="px-4 py-3"><StatusBadge status={ro.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(ro.total)}</td>
                    <td className="px-4 py-3 text-slate-600">{ro.payment_terms || '—'}</td>
                  </tr>
                ))}
                {(!followups?.orders || followups.orders.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No follow-up ROs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Open Purchase Orders */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-purple-500" />
          <h2 className="font-bold text-navy-900">Open Purchase Orders</h2>
          <span className="text-xs text-slate-400 ml-auto">{data?.purchaseOrders?.length || 0} orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">PO #</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Vendor</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Terms</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.purchaseOrders?.map((po, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{po.po_number}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{po.vendor}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(po.po_date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(po.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{po.payment_terms || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(po.due_date)}</td>
                </tr>
              ))}
              {(!data?.purchaseOrders || data.purchaseOrders.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No open purchase orders</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Repair Orders */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-500" />
          <h2 className="font-bold text-navy-900">Active Repair Orders</h2>
          <span className="text-xs text-slate-400 ml-auto">{data?.repairOrders?.length || 0} orders</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">RO #</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Vendor</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.repairOrders?.map((ro, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{ro.ro_number}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{ro.vendor}</td>
                  <td className="px-4 py-3"><StatusBadge status={ro.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(ro.due_date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(ro.total)}</td>
                </tr>
              ))}
              {(!data?.repairOrders || data.repairOrders.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No active repair orders</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automation Preview (Collapsible) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="w-full px-5 py-4 flex items-center gap-2 hover:bg-slate-50 transition-colors"
        >
          {previewOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Zap className="w-4 h-4 text-yellow-500" />
          <h2 className="font-bold text-navy-900">Automation Preview (Dry Run)</h2>
        </button>

        {previewOpen && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4">
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => runPreview('net30')}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Preview NET30 Reminders
              </button>
              <button
                onClick={() => runPreview('digest')}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Preview RO Digest
              </button>
            </div>

            {previewLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running {previewType} preview...
              </div>
            )}

            {previewResult && (
              <div className="bg-slate-900 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(previewResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
