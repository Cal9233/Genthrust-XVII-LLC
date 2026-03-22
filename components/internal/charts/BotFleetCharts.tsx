'use client'

import { LineChart, Line } from 'recharts'

// =============================================================================
// BotFleetCharts — sparkline LineChart for the Bot Status card grid
// Dynamically imported (ssr: false) from bots/page.tsx via BotFleetChartsWrapper
// =============================================================================

interface SparklineProps {
  data: { v: number }[]
  isRunning: boolean
}

export function BotSparkline({ data, isRunning }: SparklineProps) {
  return (
    <LineChart width={80} height={30} data={data} style={{ background: 'transparent' }}>
      <Line
        type="monotone"
        dataKey="v"
        stroke={isRunning ? '#3fb950' : '#484f58'}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  )
}
