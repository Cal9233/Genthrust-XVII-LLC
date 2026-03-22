'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, FileText, DollarSign, Wrench,
  AlertCircle, RefreshCw
} from 'lucide-react'

interface PortalDashboardData {
  companyName: string | null
  stats: {
    activeSOs: number
    openInvoices: number
    openBalance: number
    activeROs: number
  }
  recentSalesOrders: any[]
  recentInvoices: any[]
  recentRepairOrders: any[]
  noCompany?: boolean
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
    'Open': 'bg-blue-100 text-blue-700',
    'Active': 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Shipped': 'bg-purple-100 text-purple-700',
    'Completed': 'bg-green-100 text-green-700',
    'Closed': 'bg-slate-100 text-slate-600',
    'Paid': 'bg-green-100 text-green-700',
    'Overdue': 'bg-red-100 text-red-700',
    'Cancelled': 'bg-red-100 text-red-600',
  }

  const colorClass = colors[status] || 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: number | string
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
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

export default function PortalDashboard() {
  const router = useRouter()
  const [data, setData] = useState<PortalDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/dashboard')
      if (!res.ok) throw new Error('Failed to load dashboard')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading dashboard...</span>
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
          <button onClick={loadDashboard} className="mt-3 text-sm text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="space-y-8">
      {data?.noCompany && (
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 px-5 py-4">
          <p className="text-sm font-semibold text-yellow-800">
            Your account is not yet linked to a company. Please contact support to complete your account setup.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">Client Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Welcome{data?.companyName ? <>, <span className="font-medium text-slate-700">{data.companyName}</span></> : null}
            {' '}&mdash; Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Active SOs" value={stats?.activeSOs || 0} color="purple" />
        <StatCard icon={FileText} label="Open Invoices" value={stats?.openInvoices || 0} color="red" />
        <StatCard
          icon={DollarSign}
          label="Open Balance"
          value={formatCurrency(stats?.openBalance || 0)}
          color="green"
        />
        <StatCard icon={Wrench} label="Active ROs" value={stats?.activeROs || 0} color="orange" />
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales Orders */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-purple-500" />
              <h2 className="font-bold text-navy-900">Recent Sales Orders</h2>
            </div>
            <span className="text-xs text-slate-400">{data?.recentSalesOrders?.length || 0} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">SO #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Customer PO</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentSalesOrders?.map((so) => (
                  <tr key={so.id} onClick={() => router.push(`/portal/sales-orders/${so.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-navy-900">{so.so_number}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{so.customer_po || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={so.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(so.total)}</td>
                  </tr>
                ))}
                {(!data?.recentSalesOrders || data.recentSalesOrders.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No sales orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Repair Orders */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" />
              <h2 className="font-bold text-navy-900">Recent Repair Orders</h2>
            </div>
            <span className="text-xs text-slate-400">{data?.recentRepairOrders?.length || 0} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">RO #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentRepairOrders?.map((ro) => (
                  <tr key={ro.id} onClick={() => router.push(`/portal/repair-orders/${ro.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-navy-900">{ro.ro_number}</td>
                    <td className="px-4 py-3"><StatusBadge status={ro.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(ro.due_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(ro.total)}</td>
                  </tr>
                ))}
                {(!data?.recentRepairOrders || data.recentRepairOrders.length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No repair orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Invoices — Full Width */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              <h2 className="font-bold text-navy-900">Recent Invoices</h2>
            </div>
            <span className="text-xs text-slate-400">{data?.recentInvoices?.length || 0} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Invoice #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentInvoices?.map((inv) => (
                  <tr key={inv.id} onClick={() => router.push(`/portal/invoices/${inv.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-navy-900">{inv.invoice_no}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {inv.open_balance ? formatCurrency(inv.open_balance) : '—'}
                    </td>
                  </tr>
                ))}
                {(!data?.recentInvoices || data.recentInvoices.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
