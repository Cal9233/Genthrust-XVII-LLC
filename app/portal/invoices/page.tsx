'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle, FileText, Search } from 'lucide-react'

interface Invoice {
  id: number
  invoice_no: string
  status: string | null
  due_date: string | null
  total: number | null
  open_balance: number | null
}

interface ApiResponse {
  data: Invoice[]
  total: number
  page: number
  limit: number
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

const TABS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'Open' },
  { label: 'Overdue', value: 'Overdue' },
  { label: 'Paid', value: 'Paid' },
]

const PAGE_SIZE = 25

export default function InvoicesPage() {
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (activeTab) params.set('status', activeTab)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/portal/invoices?${params}`)
      if (!res.ok) throw new Error('Failed to load invoices')
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeTab, search, page])

  useEffect(() => { load() }, [load])

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    setPage(1)
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPage(1)
    load()
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const invoices = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data ? `${data.total.toLocaleString()} total` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {activeTab === 'Overdue' && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-3">
          <p className="text-sm font-semibold text-red-800">
            Showing overdue invoices. Please contact us to arrange payment or discuss your account.
          </p>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 pt-3 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-1" role="tablist" aria-label="Filter invoices">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={[
                  'px-3 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600/30',
                  activeTab === tab.value
                    ? tab.value === 'Overdue'
                      ? 'border-red-500 text-red-700'
                      : 'border-navy-600 text-navy-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice number..."
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 w-56"
                aria-label="Search invoices"
              />
            </div>
          </form>
        </div>

        {/* Table */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading invoices...</span>
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
            <button onClick={load} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Invoices">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Invoice #</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Open Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isOverdue = inv.status === 'Overdue'
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/portal/invoices/${inv.id}`)}
                      className={[
                        'transition-colors cursor-pointer',
                        isOverdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 font-medium text-navy-900">{inv.invoice_no}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {formatDate(inv.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(inv.total)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${inv.open_balance ? 'text-red-600' : 'text-slate-400'}`}>
                        {inv.open_balance ? formatCurrency(inv.open_balance) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {invoices.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400">No invoices found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <p className="text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pageNum = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={[
                      'w-9 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      page === pageNum
                        ? 'bg-navy-900 text-white'
                        : 'border border-slate-300 text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
