'use client'

/** Semantic variant for a status badge */
export type StatusVariant = 'info' | 'success' | 'shipped' | 'error' | 'warning' | 'neutral'

const variantStyles: Record<StatusVariant, { wrapper: string; dot: string }> = {
  info: {
    wrapper: 'bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20',
    dot: 'bg-[#58a6ff]',
  },
  success: {
    wrapper: 'bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/20',
    dot: 'bg-[#3fb950]',
  },
  shipped: {
    wrapper: 'bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/20',
    dot: 'bg-[#a371f7]',
  },
  error: {
    wrapper: 'bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20',
    dot: 'bg-[#f85149]',
  },
  warning: {
    wrapper: 'bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20',
    dot: 'bg-[#d29922]',
  },
  neutral: {
    wrapper: 'bg-white/[0.06] text-[#8b949e] border border-white/[0.08]',
    dot: 'bg-[#8b949e]',
  },
}

/**
 * Maps common status strings (as found in the ERP/ops data) to a semantic variant.
 * Call this when you have a raw status string from the API.
 */
export function statusToVariant(status: string): StatusVariant {
  const normalized = status.toUpperCase().replace(/[\s-]/g, '_')

  const infoKeys = ['OPEN', 'ACTIVE', 'IN_PROGRESS', 'INPROGRESS', 'PENDING', 'UPCOMING', 'RUNNING']
  const successKeys = ['COMPLETED', 'PAID', 'APPROVED', 'RECEIVED', 'DELIVERED_OK']
  const shippedKeys = ['SHIPPED', 'DELIVERED', 'IN_TRANSIT', 'DISPATCHED']
  const errorKeys = ['OVERDUE', 'PAST_DUE', 'CANCELLED', 'CANCELED', 'AOG', 'FAILED', 'STOPPED', 'REJECTED']
  const warningKeys = ['DUE_SOON', 'WARNING', 'LIMITED', 'PARTIAL', 'UNKNOWN']
  const neutralKeys = ['CLOSED', 'ARCHIVED', 'DRAFT', 'INACTIVE']

  if (infoKeys.includes(normalized)) return 'info'
  if (successKeys.includes(normalized)) return 'success'
  if (shippedKeys.includes(normalized)) return 'shipped'
  if (errorKeys.includes(normalized)) return 'error'
  if (warningKeys.includes(normalized)) return 'warning'
  if (neutralKeys.includes(normalized)) return 'neutral'

  // Fallback heuristics
  if (normalized.includes('CANCEL') || normalized.includes('OVER') || normalized.includes('FAIL')) return 'error'
  if (normalized.includes('WARN') || normalized.includes('SOON')) return 'warning'
  if (normalized.includes('COMPLET') || normalized.includes('PAID') || normalized.includes('APPROV')) return 'success'
  if (normalized.includes('SHIP') || normalized.includes('DELIVER')) return 'shipped'

  return 'neutral'
}

interface StatusBadgeProps {
  /** Raw status string (e.g. "PAST_DUE", "Completed", "In Progress") */
  status: string | null
  /** Override the automatic variant mapping */
  variant?: StatusVariant
  /** Custom display label. Defaults to status with underscores replaced by spaces. */
  label?: string
}

/**
 * StatusBadge — dark-mode status chip with a colored dot indicator.
 *
 * Usage:
 *   <StatusBadge status="PAST_DUE" />
 *   <StatusBadge status={row.status} variant="error" />
 *   <StatusBadge status="AOG" label="AOG" />
 */
export function StatusBadge({ status, variant, label }: StatusBadgeProps) {
  if (!status) {
    return <span className="text-xs text-[#484f58]">—</span>
  }

  const resolvedVariant = variant ?? statusToVariant(status)
  const styles = variantStyles[resolvedVariant]
  const displayLabel = label ?? status.replace(/_/g, ' ')

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${styles.wrapper}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
      {displayLabel}
    </span>
  )
}

/**
 * StatusDot — standalone colored dot with text label.
 * Use inside table cells when a badge feels too heavy.
 */
export function StatusDot({ status, label, variant }: StatusBadgeProps) {
  if (!status) {
    return <span className="text-xs text-[#484f58]">—</span>
  }

  const resolvedVariant = variant ?? statusToVariant(status)
  const styles = variantStyles[resolvedVariant]
  const displayLabel = label ?? status.replace(/_/g, ' ')

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
      <span className="text-xs text-[#f0f6fc]">{displayLabel}</span>
    </span>
  )
}
