'use client'

import { Package } from 'lucide-react'

interface InventoryCardProps {
  totalSkus: number
  activeAlarms: number
  loading?: boolean
}

export default function InventoryCard({ totalSkus, activeAlarms, loading }: InventoryCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 animate-pulse space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-8 w-16 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    )
  }

  const dotColor =
    activeAlarms > 10 ? 'bg-red-400' : activeAlarms > 0 ? 'bg-yellow-400' : 'bg-green-400'
  const statusText =
    activeAlarms > 10
      ? 'High Alerts'
      : activeAlarms > 0
      ? `${activeAlarms} alerts`
      : 'No Alerts'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col gap-3 hover:bg-white/8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Package className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">Inventory</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span className="text-xs text-slate-400">{statusText}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white font-mono">
          {totalSkus.toLocaleString()}
        </span>
        <span className="text-sm text-slate-400">SKUs tracked</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${activeAlarms > 0 ? 'bg-red-400' : 'bg-slate-500'}`} />
          {activeAlarms} unack'd alarms
        </span>
      </div>
    </div>
  )
}
