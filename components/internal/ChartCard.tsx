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
    <div className={`bg-[#161b22] border border-white/[0.06] rounded-[0.625rem] overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between bg-black/[0.12]">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#484f58] flex-shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-[0.8125rem] font-semibold text-[#f0f6fc] truncate tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-[0.6875rem] text-[#484f58] mt-0.5 leading-none">{subtitle}</p>
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
    <div className="auto-section-label">
      {Icon && <Icon className="auto-section-label-icon" />}
      <span className="auto-section-label-text">{label}</span>
      <div className="auto-section-label-line" />
    </div>
  )
}
