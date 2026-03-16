'use client'

import { useRouter } from 'next/navigation'
import {
  Bot, Database, Zap, Users, Package, Mail,
} from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface StatusOverviewData {
  bots: { total: number; running: number; stopped: number }
  erp: { activeROs: number; activeSOs: number; openInvoices: number; openBalance: number; totalParts: number }
  automation: { dueSoon: number }
  clients: { total: number; active: number; pending: number }
  inventory: { totalSkus: number; activeAlarms: number }
  quotes: { total: number; pending: number; processed: number }
}

interface StatusOverviewGridProps {
  data: StatusOverviewData | null
  loading: boolean
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

type HealthLevel = 'healthy' | 'warning' | 'critical'

const healthColors: Record<HealthLevel, string> = {
  healthy: '#3fb950',
  warning: '#d29922',
  critical: '#f85149',
}

const healthBadgeStyles: Record<HealthLevel, string> = {
  healthy: 'bg-[#3fb950]/10 text-[#3fb950]',
  warning: 'bg-[#d29922]/10 text-[#d29922]',
  critical: 'bg-[#f85149]/10 text-[#f85149]',
}

const healthLabel: Record<HealthLevel, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
}

interface OverviewCardProps {
  icon: typeof Bot
  title: string
  health: HealthLevel
  metrics: { label: string; value: string | number }[]
  onClick?: () => void
}

function OverviewCard({ icon: Icon, title, health, metrics, onClick }: OverviewCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-[#161b22] border border-white/[0.06] rounded-lg p-5
        overflow-hidden
        hover:bg-[#1a2233] hover:border-white/[0.10]
        transition-all duration-150
        ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Left accent bar — color indicates health */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ backgroundColor: healthColors[health] }}
      />

      {/* Content shifted right of the accent bar */}
      <div className="pl-2">
        {/* Top row: icon + title left, health badge right */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className="w-5 h-5 text-[#8b949e] flex-shrink-0" />
            <h3 className="text-sm font-medium text-[#f0f6fc] truncate">{title}</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              text-[10px] font-medium uppercase tracking-wide flex-shrink-0 ml-2
              ${healthBadgeStyles[health]}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: healthColors[health] }}
            />
            {healthLabel[health]}
          </span>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-0.5">
                {m.label}
              </p>
              <p className="text-xl font-mono font-semibold text-[#f0f6fc] leading-tight">
                {typeof m.value === 'number' ? (
                  <AnimatedCounter value={m.value} duration={600} />
                ) : (
                  m.value
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OverviewCardSkeleton() {
  return (
    <div className="relative bg-[#1a2233] rounded-lg p-5 overflow-hidden animate-pulse">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-white/[0.06]" />
      <div className="pl-2">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-5 h-5 rounded bg-white/[0.06]" />
          <div className="h-4 w-24 bg-white/[0.06] rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i}>
              <div className="h-2.5 w-14 bg-white/[0.06] rounded mb-1.5" />
              <div className="h-6 w-16 bg-white/[0.06] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StatusOverviewGrid({ data, loading }: StatusOverviewGridProps) {
  const router = useRouter()

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <OverviewCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const botHealth: HealthLevel = data.bots.stopped > 0
    ? (data.bots.stopped >= data.bots.total ? 'critical' : 'warning')
    : 'healthy'

  const erpHealth: HealthLevel = data.erp.openInvoices > 20 ? 'warning' : 'healthy'
  const automationHealth: HealthLevel = data.automation.dueSoon > 5 ? 'warning' : 'healthy'
  const clientHealth: HealthLevel = data.clients.pending > 5 ? 'warning' : 'healthy'
  const inventoryHealth: HealthLevel = data.inventory.activeAlarms > 0 ? 'warning' : 'healthy'
  const quotesHealth: HealthLevel = data.quotes.pending > 10 ? 'warning' : 'healthy'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <OverviewCard
        icon={Bot}
        title="Bot Fleet"
        health={botHealth}
        onClick={() => router.push('/internal/bots')}
        metrics={[
          { label: 'Running', value: `${data.bots.running}/${data.bots.total}` },
          { label: 'Stopped', value: data.bots.stopped },
        ]}
      />

      <OverviewCard
        icon={Database}
        title="ERP"
        health={erpHealth}
        onClick={() => router.push('/internal/erp')}
        metrics={[
          { label: 'Active ROs', value: data.erp.activeROs },
          { label: 'Active SOs', value: data.erp.activeSOs },
          { label: 'Open Invoices', value: data.erp.openInvoices },
          { label: 'Balance', value: formatCurrency(data.erp.openBalance) },
        ]}
      />

      <OverviewCard
        icon={Zap}
        title="Automation"
        health={automationHealth}
        onClick={() => router.push('/internal/automation')}
        metrics={[
          { label: 'Due This Week', value: data.automation.dueSoon },
          { label: 'Parts Synced', value: data.erp.totalParts.toLocaleString() },
        ]}
      />

      <OverviewCard
        icon={Users}
        title="Clients"
        health={clientHealth}
        onClick={() => router.push('/internal/clients')}
        metrics={[
          { label: 'Active', value: data.clients.active },
          { label: 'Pending', value: data.clients.pending },
        ]}
      />

      <OverviewCard
        icon={Package}
        title="Inventory"
        health={inventoryHealth}
        onClick={() => router.push('/internal/bots')}
        metrics={[
          { label: 'SKUs', value: data.inventory.totalSkus.toLocaleString() },
          { label: 'Active Alarms', value: data.inventory.activeAlarms },
        ]}
      />

      <OverviewCard
        icon={Mail}
        title="Quotes / RFQ"
        health={quotesHealth}
        onClick={() => router.push('/internal/bots')}
        metrics={[
          { label: 'Pending', value: data.quotes.pending },
          { label: 'Processed', value: data.quotes.processed },
        ]}
      />
    </div>
  )
}

export type { StatusOverviewData }
