'use client'

import { Zap } from 'lucide-react'

interface AutomationCardProps {
  dueSoon: number
  loading?: boolean
}

export default function AutomationCard({ dueSoon, loading }: AutomationCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 animate-pulse space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-8 w-16 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    )
  }

  const dotColor = dueSoon > 5 ? 'bg-red-400' : dueSoon > 0 ? 'bg-yellow-400' : 'bg-green-400'
  const statusText = dueSoon > 5 ? 'Action Needed' : dueSoon > 0 ? 'Monitor' : 'Clear'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col gap-3 hover:bg-white/8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">Automation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span className="text-xs text-slate-400">{statusText}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white font-mono">{dueSoon}</span>
        <span className="text-sm text-slate-400">due within 7 days</span>
      </div>

      <div className="text-xs text-slate-500">NET-30 payment monitoring</div>
    </div>
  )
}
