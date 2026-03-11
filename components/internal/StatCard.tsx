'use client'

import { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  color: string
  trend?: { value: number; label?: string }
  subtitle?: string
  onClick?: () => void
  loading?: boolean
}

const gradientMap: Record<string, string> = {
  blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/60',
  slate: 'from-slate-500/10 to-slate-600/5 border-slate-200/60',
  orange: 'from-orange-500/10 to-orange-600/5 border-orange-200/60',
  purple: 'from-purple-500/10 to-purple-600/5 border-purple-200/60',
  red: 'from-red-500/10 to-red-600/5 border-red-200/60',
  green: 'from-green-500/10 to-green-600/5 border-green-200/60',
  teal: 'from-teal-500/10 to-teal-600/5 border-teal-200/60',
  indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-200/60',
  yellow: 'from-yellow-500/10 to-yellow-600/5 border-yellow-200/60',
}

const iconBgMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  slate: 'bg-slate-200 text-slate-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
  red: 'bg-red-100 text-red-600',
  green: 'bg-green-100 text-green-600',
  teal: 'bg-teal-100 text-teal-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  yellow: 'bg-yellow-100 text-yellow-600',
}

export function StatCard({ icon: Icon, label, value, color, trend, subtitle, onClick, loading }: StatCardProps) {
  const gradient = gradientMap[color] || gradientMap.blue
  const iconBg = iconBgMap[color] || iconBgMap.blue

  if (loading) {
    return (
      <div className={`bg-gradient-to-br ${gradient} rounded-xl border p-4 animate-pulse`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200" />
          <div className="flex-1">
            <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-6 w-20 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-xl border p-4 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-extrabold text-slate-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>
                {trend.value > 0 ? <TrendingUp className="w-3 h-3" /> : trend.value < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 rounded-xl border border-slate-200/60 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-200" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
          <div className="h-6 w-20 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  )
}
