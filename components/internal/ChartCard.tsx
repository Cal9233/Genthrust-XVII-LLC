'use client'

import { LucideIcon } from 'lucide-react'

interface ChartCardProps {
  title: string
  icon?: LucideIcon
  iconColor?: string
  subtitle?: string
  children?: React.ReactNode
  action?: React.ReactNode
  loading?: boolean
  className?: string
  /** Add p-5 padding to the body — use when content is NOT a table */
  padded?: boolean
}

export function ChartCard({
  title,
  icon: Icon,
  subtitle,
  children,
  action,
  loading,
  className,
  padded,
}: ChartCardProps) {
  if (loading) {
    return (
      <div className={`bg-[#161b22] border border-white/[0.06] rounded-lg overflow-hidden ${className || ''}`}>
        <div className="px-5 py-3.5 border-b border-white/[0.06] animate-pulse">
          <div className="h-4 w-36 bg-white/[0.06] rounded" />
        </div>
        <div className="p-5 animate-pulse">
          <div className="h-48 bg-white/[0.04] rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-[#161b22] border border-white/[0.06] rounded-lg overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-[#8b949e] flex-shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-[#f0f6fc] truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[#8b949e] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0 ml-3">{action}</div>}
      </div>

      {/* Body */}
      <div className={padded ? 'p-5' : undefined}>
        {children}
      </div>
    </div>
  )
}

export function SectionDivider({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#484f58]" />}
      <span className="text-[10px] font-semibold text-[#484f58] uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.05]" />
    </div>
  )
}
