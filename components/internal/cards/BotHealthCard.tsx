'use client'

import { Bot } from 'lucide-react'

interface BotHealthCardProps {
  running: number
  total: number
  stopped: number
  loading?: boolean
}

function statusColor(running: number, total: number) {
  if (total === 0) return 'bg-slate-400'
  if (running === total) return 'bg-green-400'
  if (running === 0) return 'bg-red-400'
  return 'bg-yellow-400'
}

function statusLabel(running: number, total: number) {
  if (total === 0) return 'Unknown'
  if (running === total) return 'All Running'
  if (running === 0) return 'All Stopped'
  return 'Degraded'
}

export default function BotHealthCard({ running, total, stopped, loading }: BotHealthCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 animate-pulse space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-8 w-16 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    )
  }

  const dot = statusColor(running, total)
  const label = statusLabel(running, total)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col gap-3 hover:bg-white/8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">Bot Fleet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dot} shadow-sm`} aria-hidden="true" />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white font-mono">{running}</span>
        <span className="text-sm text-slate-400">/ {total} active</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {stopped} stopped
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {running} running
        </span>
      </div>
    </div>
  )
}
