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
}

export function ChartCard({ title, icon: Icon, iconColor, subtitle, children, action, loading, className }: ChartCardProps) {
  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className || ''}`}>
        <div className="px-5 py-4 border-b border-slate-100 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded" />
        </div>
        <div className="p-5 animate-pulse">
          <div className="h-48 bg-slate-100 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className || ''}`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconColor || 'text-slate-500'}`} />}
          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

export function SectionDivider({ label, icon: Icon }: { label: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}
