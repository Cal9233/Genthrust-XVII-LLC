'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, UserCheck, UserX, Trash2 } from 'lucide-react'

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ClientsManagementPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [updating, setUpdating] = useState<number | null>(null)

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

  const filtered = filter === 'pending' ? clients.filter((c) => !c.is_active) : clients

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading clients...</span>
        </div>
      </div>
    )
  }

  if (error && !clients.length) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadClients} className="mt-3 text-sm text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">Client Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage portal user registrations and access.</p>
        </div>
        <button
          onClick={loadClients}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'pending'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Pending ({clients.filter((c) => !c.is_active).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-navy-900 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          All ({clients.length})
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Contact Name</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Email</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Company</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Created</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900">{client.contact_name}</td>
                  <td className="px-4 py-3 text-slate-600">{client.email}</td>
                  <td className="px-4 py-3 text-slate-600">{client.company_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {client.is_active ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(client.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(client.id, client.is_active)}
                        disabled={updating === client.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                          client.is_active
                            ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                            : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
                        }`}
                      >
                        {updating === client.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : client.is_active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        {client.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {!client.is_active && (
                        <button
                          onClick={() => rejectUser(client.id)}
                          disabled={updating === client.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200"
                        >
                          {updating === client.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    {filter === 'pending' ? 'No pending registrations' : 'No clients'}
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
