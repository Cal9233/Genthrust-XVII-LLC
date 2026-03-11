'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, AlertCircle, UserCheck, UserX, Trash2, Users, UserPlus, ShieldCheck } from 'lucide-react'
import { StatCard } from '@/components/internal/StatCard'
import { DataTable, StatusDot } from '@/components/internal/DataTable'
import { ChartCard } from '@/components/internal/ChartCard'

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterTab = 'all' | 'active' | 'pending'

interface Client {
  id: number
  contact_name: string
  email: string
  company_name: string | null
  is_active: number
  created_at: string
}

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
        className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-500 delay-100 ${
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

      {/* Table section */}
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
    </div>
  )
}
