'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, AlertCircle, UserCheck, UserX, Trash2, Users, UserPlus, ShieldCheck, Building2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable, StatusDot } from '@/components/internal/DataTable'
import { ChartCard } from '@/components/internal/ChartCard'

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterTab = 'all' | 'active' | 'pending'
type SortDir = 'asc' | 'desc'
type CompanySortKey = 'company_name' | 'user_count' | 'active_count'

interface Client {
  id: number
  contact_name: string
  email: string
  company_name: string | null
  is_active: number
  created_at: string
}

interface CompanyRow {
  company_name: string
  user_count: number
  active_count: number
  pending_count: number
  contacts: string[]
}

// ── Company Directory ──────────────────────────────────────────────────────────

function CompanyDirectory({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<CompanySortKey>('company_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const companies = useMemo<CompanyRow[]>(() => {
    const map = new Map<string, CompanyRow>()
    for (const c of clients) {
      const key = c.company_name?.trim() || '(No Company)'
      if (!map.has(key)) {
        map.set(key, { company_name: key, user_count: 0, active_count: 0, pending_count: 0, contacts: [] })
      }
      const row = map.get(key)!
      row.user_count++
      if (c.is_active) row.active_count++
      else row.pending_count++
      if (row.contacts.length < 3) row.contacts.push(c.contact_name)
    }
    return Array.from(map.values())
  }, [clients])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return companies
      .filter((c) => !q || c.company_name.toLowerCase().includes(q))
      .sort((a, b) => {
        let diff = 0
        if (sortKey === 'company_name') diff = a.company_name.localeCompare(b.company_name)
        else if (sortKey === 'user_count') diff = a.user_count - b.user_count
        else if (sortKey === 'active_count') diff = a.active_count - b.active_count
        return sortDir === 'asc' ? diff : -diff
      })
  }, [companies, search, sortKey, sortDir])

  function toggleSort(key: CompanySortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: CompanySortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-[#1B3A6B]" />
      : <ChevronDown className="w-3 h-3 text-[#1B3A6B]" />
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/20 focus:border-[#1B3A6B]/50 placeholder:text-slate-400 text-slate-800"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {search ? `No companies match "${search}"` : 'No companies found'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-3 pr-4">
                  <button
                    onClick={() => toggleSort('company_name')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
                  >
                    Company <SortIcon col="company_name" />
                  </button>
                </th>
                <th className="text-left pb-3 pr-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacts</span>
                </th>
                <th className="text-left pb-3 pr-4">
                  <button
                    onClick={() => toggleSort('user_count')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
                  >
                    Portal Users <SortIcon col="user_count" />
                  </button>
                </th>
                <th className="text-left pb-3">
                  <button
                    onClick={() => toggleSort('active_count')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
                  >
                    Status <SortIcon col="active_count" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((co) => (
                <tr key={co.company_name} className="group hover:bg-slate-50/70 transition-colors duration-100">
                  {/* Company name */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #5B8DB8 100%)' }}
                      >
                        {co.company_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-900">{co.company_name}</span>
                    </div>
                  </td>

                  {/* Contact names */}
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-0.5">
                      {co.contacts.map((name) => (
                        <span key={name} className="text-xs text-slate-500">{name}</span>
                      ))}
                      {co.user_count > co.contacts.length && (
                        <span className="text-xs text-slate-400">+{co.user_count - co.contacts.length} more</span>
                      )}
                    </div>
                  </td>

                  {/* User count */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{co.user_count}</span>
                    </div>
                  </td>

                  {/* Status breakdown */}
                  <td className="py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {co.active_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {co.active_count} active
                        </span>
                      )}
                      {co.pending_count > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {co.pending_count} pending
                        </span>
                      )}
                      {co.active_count === 0 && co.pending_count === 0 && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
        {search ? ` matching "${search}"` : ' in directory'}
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ClientsManagementPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [updating, setUpdating] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)

  async function loadClients() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/clients')
      if (!res.ok) throw new Error('Failed to load clients')
      const json = await res.json()
      setClients(json.clients)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(timer)
    }
    setVisible(false)
  }, [loading])

  async function toggleActive(userId: number, currentActive: number) {
    setUpdating(userId)
    try {
      const res = await fetch('/api/internal/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_active: currentActive ? 0 : 1 }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setClients((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, is_active: currentActive ? 0 : 1 } : c))
      )
    } catch {
      setError('Failed to update client status')
    } finally {
      setUpdating(null)
    }
  }

  async function rejectUser(userId: number) {
    setUpdating(userId)
    try {
      const res = await fetch('/api/internal/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      setClients((prev) => prev.filter((c) => c.id !== userId))
    } catch {
      setError('Failed to reject client')
    } finally {
      setUpdating(null)
    }
  }

  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.is_active).length
  const pendingClients = clients.filter((c) => !c.is_active).length
  const totalCompanies = useMemo(
    () => new Set(clients.map((c) => c.company_name?.trim() || '(No Company)')).size,
    [clients]
  )

  const filtered = useMemo(() => {
    if (filter === 'active') return clients.filter((c) => c.is_active)
    if (filter === 'pending') return clients.filter((c) => !c.is_active)
    return clients
  }, [clients, filter])

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: pendingClients },
    { key: 'active', label: 'Active', count: activeClients },
    { key: 'all', label: 'All', count: totalClients },
  ]

  const columns = [
    {
      key: 'contact_name',
      label: 'Contact Name',
      sortable: true,
      render: (row: Client) => (
        <span className="font-semibold text-slate-900">{row.contact_name}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (row: Client) => (
        <span className="text-slate-600">{row.email}</span>
      ),
    },
    {
      key: 'company_name',
      label: 'Company',
      sortable: true,
      render: (row: Client) => (
        <span className="text-slate-600">{row.company_name || '—'}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (row: Client) => (
        <StatusDot
          status={row.is_active ? 'Active' : 'Pending'}
          label={row.is_active ? 'Active' : 'Pending'}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Registered',
      sortable: true,
      render: (row: Client) => (
        <span className="text-slate-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (row: Client) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleActive(row.id, row.is_active) }}
            disabled={updating === row.id}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 ${
              row.is_active
                ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300'
                : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-300'
            }`}
          >
            {updating === row.id ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : row.is_active ? (
              <UserX className="w-3.5 h-3.5" />
            ) : (
              <UserCheck className="w-3.5 h-3.5" />
            )}
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          {!row.is_active && (
            <button
              onClick={(e) => { e.stopPropagation(); rejectUser(row.id) }}
              disabled={updating === row.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300"
            >
              {updating === row.id ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Reject
            </button>
          )}
        </div>
      ),
    },
  ]

  if (error && !clients.length && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-700 font-semibold text-lg mb-1">Unable to load clients</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button
            onClick={loadClients}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`flex items-center justify-between transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Client Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage portal user registrations and access.</p>
        </div>
        <button
          onClick={loadClients}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-4 gap-4 transition-all duration-500 delay-100 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <StatCard
          icon={Users}
          label="Total Clients"
          value={totalClients}
          color="blue"
          subtitle="All registered users"
          loading={loading}
          onClick={() => setFilter('all')}
        />
        <StatCard
          icon={ShieldCheck}
          label="Active"
          value={activeClients}
          color="green"
          subtitle="Approved accounts"
          loading={loading}
          onClick={() => setFilter('active')}
        />
        <StatCard
          icon={UserPlus}
          label="Pending Approval"
          value={pendingClients}
          color="orange"
          subtitle="Awaiting review"
          loading={loading}
          onClick={() => setFilter('pending')}
        />
        <StatCard
          icon={Building2}
          label="Companies"
          value={totalCompanies}
          color="indigo"
          subtitle="In directory"
          loading={loading}
        />
      </div>

      {/* Error banner */}
      {error && clients.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Portal Users table */}
      <div
        className={`transition-all duration-500 delay-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <ChartCard
          title="Client Registry"
          icon={Users}
          iconColor="text-blue-500"
          subtitle={`${filtered.length} ${filter === 'all' ? 'total' : filter} client${filtered.length !== 1 ? 's' : ''}`}
          loading={loading}
          action={
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                    filter === tab.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      filter === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          }
        >
          <DataTable<Client>
            columns={columns}
            data={filtered}
            loading={loading}
            emptyMessage={
              filter === 'pending'
                ? 'No pending registrations'
                : filter === 'active'
                ? 'No active clients'
                : 'No clients registered yet'
            }
          />
        </ChartCard>
      </div>

      {/* Company Directory */}
      <div
        className={`transition-all duration-500 delay-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <ChartCard
          title="Company Directory"
          icon={Building2}
          iconColor="text-[#1B3A6B]"
          subtitle={`${totalCompanies} ${totalCompanies === 1 ? 'company' : 'companies'} with portal access`}
          loading={loading}
        >
          <CompanyDirectory clients={clients} />
        </ChartCard>
      </div>
    </div>
  )
}
