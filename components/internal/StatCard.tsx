'use client'

import { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

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

export function StatCard({ icon: Icon, label, value, trend, subtitle, onClick, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-[#1a2233] rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 rounded bg-white/[0.06]" />
          <div className="h-2.5 w-20 bg-white/[0.06] rounded" />
        </div>
        <div className="h-8 w-24 bg-white/[0.06] rounded" />
      </div>
    )
  }

  return (
    <div
      className={`bg-[#161b22] border border-white/[0.06] rounded-lg p-4
        hover:border-white/[0.12] transition-colors duration-150
        ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-4 h-4 text-[#8b949e] flex-shrink-0" />
        <p className="text-[10px] font-medium text-[#8b949e] uppercase tracking-wider truncate">
          {label}
        </p>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold font-mono text-[#f0f6fc] leading-none">
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} duration={600} />
          ) : (
            value
          )}
        </p>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
            trend.value > 0
              ? 'text-[#3fb950]'
              : trend.value < 0
              ? 'text-[#f85149]'
              : 'text-[#8b949e]'
          }`}>
            {trend.value > 0
              ? <TrendingUp className="w-3 h-3" />
              : trend.value < 0
              ? <TrendingDown className="w-3 h-3" />
              : <Minus className="w-3 h-3" />
            }
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {/* Subtitle / trend label */}
      {(subtitle || trend?.label) && (
        <p className="text-[10px] text-[#8b949e] mt-1">
          {subtitle || trend?.label}
        </p>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#1a2233] rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-20 bg-white/[0.06] rounded" />
      </div>
      <div className="h-8 w-24 bg-white/[0.06] rounded" />
    </div>
  )
}
