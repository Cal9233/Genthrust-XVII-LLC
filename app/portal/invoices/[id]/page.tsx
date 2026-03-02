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
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Paid': 'bg-green-100 text-green-700',
    'Overdue': 'bg-red-100 text-red-700',
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

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/invoices/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Invoice not found')
        throw new Error('Failed to load invoice')
      }
      const json = await res.json()
      setInvoice(json.invoice)
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
          <span>Loading invoice...</span>
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
          <Link href="/portal" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900">{invoice.invoice_no}</h1>
            <p className="text-slate-500 text-sm mt-1">Invoice</p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 font-medium">Account</p>
            <p className="text-navy-900 font-semibold">{invoice.account_name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Contact</p>
            <p className="text-navy-900 font-semibold">{invoice.contact_name || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">SO #</p>
            <p className="text-navy-900 font-semibold">{invoice.so_number || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Customer PO</p>
            <p className="text-navy-900 font-semibold">{invoice.customer_po || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Invoice Date</p>
            <p className="text-navy-900 font-semibold">{formatDate(invoice.invoice_date)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Due Date</p>
            <p className="text-navy-900 font-semibold">{formatDate(invoice.due_date)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Ship Via</p>
            <p className="text-navy-900 font-semibold">{invoice.ship_via || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Tracking #</p>
            <p className="text-navy-900 font-semibold">{invoice.track_no || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Subtotal</p>
            <p className="text-navy-900 font-semibold">{formatCurrency(invoice.subtotal)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Discount</p>
            <p className="text-navy-900 font-semibold">{formatCurrency(invoice.total_discount)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Total</p>
            <p className="text-navy-900 font-extrabold text-lg">{formatCurrency(invoice.total)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">Open Balance</p>
            <p className="text-red-600 font-extrabold text-lg">
              {invoice.open_balance ? formatCurrency(invoice.open_balance) : '—'}
            </p>
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
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(line.unit_price)}</td>
                  <td className="px-4 py-3 text-slate-600">{line.uom || '—'}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
