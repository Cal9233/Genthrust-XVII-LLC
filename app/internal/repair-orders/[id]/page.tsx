'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'

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
    'Completed': 'bg-green-100 text-green-700',
    'Closed': 'bg-slate-100 text-slate-600',
    'Cancelled': 'bg-red-100 text-red-600',
  }
  const colorClass = colors[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

export default function InternalRepairOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/internal/repair-orders/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Repair order not found')
        throw new Error('Failed to load repair order')
      }
      const json = await res.json()
      setOrder(json.order)
      setLines(json.lines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading repair order...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <Link href="/internal" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/internal" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900">{order.ro_number}</h1>
            <p className="text-slate-500 text-sm mt-1">Repair Order</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 font-medium">Vendor</p>
            <p className="text-navy-900 font-semibold">{order.vendor_name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Contact</p>
            <p className="text-navy-900 font-semibold">{order.contact_name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Priority</p>
            <p className="text-navy-900 font-semibold">{order.priority || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Due Date</p>
            <p className="text-navy-900 font-semibold">{formatDate(order.due_date)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Ship Via</p>
            <p className="text-navy-900 font-semibold">{order.ship_via || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Ship Account</p>
            <p className="text-navy-900 font-semibold">{order.ship_account || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Terms (Sale)</p>
            <p className="text-navy-900 font-semibold">{order.term_sale || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Total</p>
            <p className="text-navy-900 font-extrabold text-lg">{formatCurrency(order.total)}</p>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-navy-900">Line Items</h2>
          <span className="text-xs text-slate-400">{lines.length} item{lines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">#</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Name</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Cond</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Serial #</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Qty</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Rcvd</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Dlvd</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Unit Price</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">UOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{line.line_number}</td>
                  <td className="px-4 py-3 font-medium text-navy-900">{line.part_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate">{line.description || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{line.condition_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{line.serial_number || '—'}</td>
                  <td className="px-4 py-3 text-right">{line.qty ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{line.qty_received ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{line.qty_delivered ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(line.unit_price)}</td>
                  <td className="px-4 py-3 text-slate-600">{line.uom || '—'}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
