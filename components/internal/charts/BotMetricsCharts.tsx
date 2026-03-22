'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// =============================================================================
// BotMetricsCharts — PieChart (SKU Distribution) and BarChart (Sales Velocity)
// Dynamically imported (ssr: false) from bots/page.tsx
// Dark theme preserved exactly from Phase 4 revamp.
// =============================================================================

// --- Shared tooltip components (dark-themed) ---------------------------------

function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-[#1a2233] border border-white/[0.08] rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[#f0f6fc]">{d.name}</p>
      <p className="text-[#8b949e]">{d.value} SKUs</p>
    </div>
  )
}

function BarTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a2233] border border-white/[0.08] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-semibold text-[#f0f6fc] mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-[#8b949e]">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// --- PieChart ----------------------------------------------------------------

interface SkuPieChartProps {
  pieData: { name: string; value: number }[]
  pieColors: string[]
}

export function SkuPieChart({ pieData, pieColors }: SkuPieChartProps) {
  if (pieData.length === 0) {
    return <p className="text-sm text-[#484f58] text-center py-10">No condition data available</p>
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart style={{ background: 'transparent' }}>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          stroke="#0b0f14"
          strokeWidth={2}
        >
          {pieData.map((_, idx) => (<Cell key={idx} fill={pieColors[idx]} />))}
        </Pie>
        <RechartsTooltip
          content={<PieTooltipContent />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: '#8b949e', fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// --- BarChart ----------------------------------------------------------------

interface VelocityBarData {
  part: string
  '7d': number
  '30d': number
  '90d': number
}

interface VelocityBarChartProps {
  barData: VelocityBarData[]
}

export function VelocityBarChart({ barData }: VelocityBarChartProps) {
  if (barData.length === 0) {
    return <p className="text-sm text-[#484f58] text-center py-10">No velocity data available</p>
  }
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={barData}
        margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
        style={{ background: 'transparent' }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="part"
          tick={{ fontSize: 11, fill: '#8b949e', fontFamily: 'IBM Plex Mono, monospace' }}
          axisLine={{ stroke: '#1a2233' }}
          tickLine={{ stroke: '#1a2233' }}
          angle={-35}
          textAnchor="end"
          height={70}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#8b949e', fontFamily: 'IBM Plex Mono, monospace' }}
          axisLine={{ stroke: '#1a2233' }}
          tickLine={{ stroke: '#1a2233' }}
          allowDecimals={false}
        />
        <RechartsTooltip
          content={<BarTooltipContent />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="7d" name="7-day" fill="#58a6ff" radius={[4, 4, 0, 0]} />
        <Bar dataKey="30d" name="30-day" fill="#a371f7" radius={[4, 4, 0, 0]} />
        <Bar dataKey="90d" name="90-day" fill="#3fb950" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
