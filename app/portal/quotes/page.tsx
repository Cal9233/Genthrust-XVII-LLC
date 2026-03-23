'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, AlertCircle, MessageSquarePlus, Plus, ExternalLink } from 'lucide-react'

interface Quote {
  id: number
  created_at: string
  part_count: number
  status: 'pending' | 'responded' | 'expired'
}

interface ApiResponse {
  data: Quote[]
  total: number
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {labels[status] || status}
    </span>
  )
}

export default function QuotesPage() {
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/quotes')
      if (!res.ok) throw new Error('Failed to load quotes')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const quotes = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Quote Requests</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${data.total.toLocaleString()} total` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/portal/quotes/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Quote Request
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading quote requests...</span>
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={load} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Quote requests">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">ID</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Parts</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy-900">#{quote.id}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(quote.created_at)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{quote.part_count}</td>
                    <td className="px-4 py-3"><QuoteStatusBadge status={quote.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/portal/quotes/${quote.id}`)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-600 hover:text-navy-900 transition-colors focus-visible:outline-none focus-visible:underline"
                        aria-label={`View quote #${quote.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <MessageSquarePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 mb-4">No quote requests yet</p>
                      <Link
                        href="/portal/quotes/new"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Submit your first quote request
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
