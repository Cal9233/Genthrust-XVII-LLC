'use client'

import { FileText } from 'lucide-react'

interface QuotesCardProps {
  total: number
  pending: number
  processed: number
  loading?: boolean
}

export default function QuotesCard({ total, pending, processed, loading }: QuotesCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 animate-pulse space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-8 w-16 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    )
  }

  const dotColor = pending > 10 ? 'bg-red-400' : pending > 0 ? 'bg-yellow-400' : 'bg-green-400'
  const statusText = pending > 0 ? `${pending} pending` : 'Queue clear'

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col gap-3 hover:bg-white/8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">Quotes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span className="text-xs text-slate-400">{statusText}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white font-mono">{pending}</span>
        <span className="text-sm text-slate-400">pending / {total} total</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {processed} processed
        </span>
      </div>
    </div>
  )
}
