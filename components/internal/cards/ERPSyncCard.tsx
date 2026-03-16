'use client'

import { Database } from 'lucide-react'

interface ERPSyncCardProps {
  activeROs: number
  activeSOs: number
  openInvoices: number
  openBalance: number
  loading?: boolean
}

function formatCurrency(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`
  return `$${val.toFixed(0)}`
}

export default function ERPSyncCard({
  activeROs,
  activeSOs,
  openInvoices,
  openBalance,
  loading,
}: ERPSyncCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 animate-pulse space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-8 w-16 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    )
  }

  const hasIssues = openBalance > 50_000
  const dotColor = hasIssues ? 'bg-yellow-400' : 'bg-green-400'
  const statusText = hasIssues ? 'Attention' : 'Healthy'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col gap-3 hover:bg-white/8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">ERP Sync</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span className="text-xs text-slate-400">{statusText}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white font-mono">
          {formatCurrency(openBalance)}
        </span>
        <span className="text-sm text-slate-400">open balance</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-500">ROs</span>
          <span className="text-white font-semibold font-mono">{activeROs}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-500">SOs</span>
          <span className="text-white font-semibold font-mono">{activeSOs}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-500">Invoices</span>
          <span className="text-white font-semibold font-mono">{openInvoices}</span>
        </div>
      </div>
    </div>
  )
}
