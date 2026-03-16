'use client'

import { useRouter } from 'next/navigation'
import {
  Bot, Database, Zap, Users, Package, Mail,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react'

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

function StatusDot({ level }: { level: HealthLevel }) {
  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  }
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[level]} animate-pulse`} />
  )
}

function StatusIcon({ level }: { level: HealthLevel }) {
  if (level === 'healthy') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (level === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-500" />
  return <XCircle className="w-4 h-4 text-red-500" />
}

interface OverviewCardProps {
  icon: typeof Bot
  title: string
  health: HealthLevel
  metrics: { label: string; value: string | number }[]
  gradient: string
  iconBg: string
  onClick?: () => void
}

function OverviewCard({ icon: Icon, title, health, metrics, gradient, iconBg, onClick }: OverviewCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${gradient} rounded-xl border p-5 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot level={health} />
          <StatusIcon level={health} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{m.label}</p>
            <p className="text-lg font-bold text-slate-900 font-mono">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 rounded-xl border border-slate-200/60 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-200" />
        <div className="h-5 w-24 bg-slate-200 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i}>
            <div className="h-3 w-14 bg-slate-200 rounded mb-1" />
            <div className="h-6 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatusOverviewGrid({ data, loading }: StatusOverviewGridProps) {
  const router = useRouter()

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <OverviewCard
        icon={Bot}
        title="Bot Fleet"
        health={botHealth}
        gradient="from-blue-500/10 to-blue-600/5 border-blue-200/60"
        iconBg="bg-blue-100 text-blue-600"
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
        gradient="from-indigo-500/10 to-indigo-600/5 border-indigo-200/60"
        iconBg="bg-indigo-100 text-indigo-600"
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
        gradient="from-orange-500/10 to-orange-600/5 border-orange-200/60"
        iconBg="bg-orange-100 text-orange-600"
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
        gradient="from-teal-500/10 to-teal-600/5 border-teal-200/60"
        iconBg="bg-teal-100 text-teal-600"
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
        gradient="from-purple-500/10 to-purple-600/5 border-purple-200/60"
        iconBg="bg-purple-100 text-purple-600"
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
        gradient="from-red-500/10 to-red-600/5 border-red-200/60"
        iconBg="bg-red-100 text-red-600"
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
