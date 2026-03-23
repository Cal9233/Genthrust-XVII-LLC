'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react'

interface QuoteLineItem {
  id: number
  part_number: string
  quantity: number
  condition: string | null
  notes: string | null
  unit_price: number | null
  response_notes: string | null
}

interface QuoteDetail {
  id: number
  created_at: string
  status: 'pending' | 'responded' | 'expired'
  urgency: string | null
  notes: string | null
  staff_response: string | null
  responded_at: string | null
}

interface ApiResponse {
  quote: QuoteDetail
  lineItems: QuoteLineItem[]
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function QuoteStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'pending': 'bg-yellow-100 text-yellow-700',
    'responded': 'bg-green-100 text-green-700',
    'expired': 'bg-slate-100 text-slate-500',
  }
  const labels: Record<string, string> = {
    'pending': 'Pending',
    'responded': 'Responded',
    'expired': 'Expired',
  }
  const colorClass = styles[status] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
      {labels[status] || status}
    </span>
  )
}

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return null
  const styles: Record<string, string> = {
    'AOG': 'bg-red-100 text-red-700',
    'Critical': 'bg-red-100 text-red-700',
    'Priority': 'bg-orange-100 text-orange-700',
    'Routine': 'bg-slate-100 text-slate-600',
  }
  const colorClass = styles[urgency] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {urgency}
    </span>
  )
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/quotes/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Quote request not found')
        throw new Error('Failed to load quote')
      }
      setData(await res.json())
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
          <span>Loading quote...</span>
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
          <Link href="/portal/quotes" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Back to Quotes
          </Link>
        </div>
      </div>
    )
  }

  const { quote, lineItems } = data!
  const hasResponse = quote.status === 'responded'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/portal/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Quotes
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900">Quote Request #{quote.id}</h1>
            <p className="text-slate-500 text-sm mt-1">Submitted {formatDate(quote.created_at)}</p>
          </div>
          <QuoteStatusBadge status={quote.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500 font-medium">Urgency</p>
            <div className="mt-1"><UrgencyBadge urgency={quote.urgency} /></div>
          </div>
          {hasResponse && (
            <div>
              <p className="text-slate-500 font-medium">Responded</p>
              <p className="text-navy-900 font-semibold mt-0.5">{formatDate(quote.responded_at)}</p>
            </div>
          )}
          <div>
            <p className="text-slate-500 font-medium">Parts</p>
            <p className="text-navy-900 font-semibold mt-0.5">
              {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Your Notes</p>
            <p className="text-sm text-slate-700">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Staff Response (if responded) */}
      {hasResponse && quote.staff_response && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-green-600" aria-hidden="true" />
            <h2 className="font-bold text-green-900">Response from GenThrust</h2>
          </div>
          <p className="text-sm text-green-800 leading-relaxed">{quote.staff_response}</p>
        </div>
      )}

      {/* Pending state notice */}
      {quote.status === 'pending' && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 px-5 py-4">
          <p className="text-sm font-semibold text-yellow-800">
            Your request is under review. Our team will respond with pricing and availability shortly.
          </p>
        </div>
      )}

      {/* Expired state notice */}
      {quote.status === 'expired' && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">
            This quote request has expired. You can submit a new request if you still need pricing.
          </p>
          <Link
            href="/portal/quotes/new"
            className="ml-4 flex-shrink-0 px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
          >
            New Request
          </Link>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-navy-900">Parts Requested</h2>
          <span className="text-xs text-slate-400">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Quote line items">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">#</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Part Number</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Qty</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Condition</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Notes</th>
                {hasResponse && (
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Unit Price</th>
                )}
                {hasResponse && (
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Response</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineItems.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-navy-900 font-mono">{item.part_number}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{item.condition || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{item.notes || '—'}</td>
                  {hasResponse && (
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatCurrency(item.unit_price)}
                    </td>
                  )}
                  {hasResponse && (
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {item.response_notes || '—'}
                    </td>
                  )}
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={hasResponse ? 7 : 5} className="px-4 py-6 text-center text-slate-400">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
