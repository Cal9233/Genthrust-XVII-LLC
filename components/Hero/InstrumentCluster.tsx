'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// --- Arc Gauge ---
interface ArcGaugeProps {
  value: number        // 0-100
  label: string
  unit: string
  color: string
  size?: number
  delay?: number
}

export function ArcGauge({ value, label, unit, color, size = 88, delay = 0 }: ArcGaugeProps) {
  const r = (size / 2) - 10
  const circumference = Math.PI * r  // half-circle arc
  const strokeDash = (value / 100) * circumference
  const cx = size / 2
  const cy = size / 2 + 8

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
        <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`} style={{ overflow: 'visible' }}>
          {/* Track arc */}
          <path
            d={`M ${10} ${cy} A ${r} ${r} 0 0 1 ${size - 10} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI * (tick / 100)
            const tickR = r + 6
            const x1 = cx - Math.cos(angle) * (r - 2)
            const y1 = cy - Math.sin(angle) * (r - 2)
            const x2 = cx - Math.cos(angle) * (r + 3)
            const y2 = cy - Math.sin(angle) * (r + 3)
            return (
              <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" />
            )
          })}
          {/* Value arc */}
          <motion.path
            d={`M ${10} ${cy} A ${r} ${r} 0 0 1 ${size - 10} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - strokeDash }}
            transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Needle dot */}
          <motion.circle
            cx={cx - Math.cos(Math.PI * (value / 100)) * r}
            cy={cy - Math.sin(Math.PI * (value / 100)) * r}
            r="3"
            fill={color}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 1.2, duration: 0.3 }}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
          {/* Center value */}
          <text x={cx} y={cy + 4} textAnchor="middle"
            fill="rgba(255,255,255,0.9)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="600">
            {value}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle"
            fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="JetBrains Mono, monospace" letterSpacing="1">
            {unit}
          </text>
        </svg>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">{label}</span>
    </div>
  )
}

// --- Compass Rose ---
export function CompassRose({ heading = 247, delay = 0 }: { heading?: number; delay?: number }) {
  const size = 80
  const cx = size / 2
  const cy = size / 2
  const r = 30

  const cardinals = ['N', 'E', 'S', 'W']
  const cardinalAngles = [0, 90, 180, 270]

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        initial={{ opacity: 0, rotate: heading - 30 }}
        animate={{ opacity: 1, rotate: heading }}
        transition={{ duration: 2, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ originX: '50%', originY: '50%' }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="rgba(56,178,172,0.12)" strokeWidth="1" />
          {/* Degree ticks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i * 10 * Math.PI) / 180
            const isMajor = i % 9 === 0
            const r1 = r + (isMajor ? 0 : 2)
            const r2 = r + 5
            return (
              <line key={i}
                x1={cx + Math.sin(a) * r1} y1={cy - Math.cos(a) * r1}
                x2={cx + Math.sin(a) * r2} y2={cy - Math.cos(a) * r2}
                stroke={isMajor ? 'rgba(56,178,172,0.5)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isMajor ? '1.5' : '0.5'}
              />
            )
          })}
          {/* Cardinal labels */}
          {cardinals.map((c, i) => {
            const a = (cardinalAngles[i] * Math.PI) / 180
            return (
              <text key={c}
                x={cx + Math.sin(a) * (r - 8)} y={cy - Math.cos(a) * (r - 8) + 3}
                textAnchor="middle" fill={c === 'N' ? '#9c2a3e' : 'rgba(255,255,255,0.5)'}
                fontSize="7" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                {c}
              </text>
            )
          })}
          {/* Rose petals */}
          <polygon points={`${cx},${cy - r + 10} ${cx - 4},${cy} ${cx},${cy + 8} ${cx + 4},${cy}`}
            fill="rgba(56,178,172,0.6)" />
          <polygon points={`${cx},${cy - r + 10} ${cx - 4},${cy} ${cx},${cy - 4} ${cx + 4},${cy}`}
            fill="rgba(56,178,172,0.25)" />
          {/* Center dot */}
          <circle cx={cx} cy={cy} r="2.5" fill="#38B2AC" style={{ filter: 'drop-shadow(0 0 3px #38B2AC)' }} />
        </svg>
      </motion.div>
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">HDG {heading}°</span>
    </div>
  )
}

// --- Telemetry Ticker ---
const TELEMETRY_LINES = [
  'ICAO: KMIA · MIA/INTL · 11FT MSL',
  'FREQ: 121.500 GUARD · 123.450 ATIS',
  'METAR: KMIA 141253Z 09007KT 10SM FEW025 28/22 A2993',
  'NOTAM: TFR ACTIVE WITHIN 30NM · REVIEW BEFORE DISPATCH',
  'STOCK: B737-NG ACTUATORS IN 14DAY LEAD · MFR VERIFIED',
  'AOG: PRIORITY LANE ACTIVE · ETA < 4HR MIA → LAX',
  'CERT: FAA AC 00-56B · EASA PART 145 COMPLIANT',
  'SYS: INVENTORY SYNC NOMINAL · LAST RUN 00:04:17 AGO',
]

export function TelemetryTicker({ delay = 0 }: { delay?: number }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % TELEMETRY_LINES.length)
        setVisible(true)
      }, 300)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
      className="w-full border border-white/[0.06] rounded bg-white/[0.02] px-3 py-1.5 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-horizon-blue animate-pulse" />
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
          transition={{ duration: 0.25 }}
          className="font-mono text-[10px] text-white/40 tracking-wider truncate"
        >
          {TELEMETRY_LINES[index]}
        </motion.span>
      </div>
    </motion.div>
  )
}

// --- Status Grid ---
interface StatusItem {
  code: string
  label: string
  status: 'nominal' | 'active' | 'alert'
}

const STATUS_ITEMS: StatusItem[] = [
  { code: 'INV', label: 'Inventory', status: 'nominal' },
  { code: 'ERP', label: 'ERP Sync', status: 'nominal' },
  { code: 'AOG', label: 'AOG Lane', status: 'active' },
  { code: 'QA',  label: 'Cert Status', status: 'nominal' },
]

const STATUS_COLORS = {
  nominal: '#059669',
  active:  '#38B2AC',
  alert:   '#9c2a3e',
}

export function StatusGrid({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="grid grid-cols-2 gap-1.5"
    >
      {STATUS_ITEMS.map((item, i) => (
        <motion.div
          key={item.code}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + i * 0.08, duration: 0.35 }}
          className="flex items-center gap-1.5 border border-white/[0.06] rounded px-2 py-1 bg-white/[0.02]"
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: STATUS_COLORS[item.status],
              boxShadow: `0 0 4px ${STATUS_COLORS[item.status]}`,
            }}
          />
          <span className="font-mono text-[9px] text-white/25 tracking-wider flex-1">{item.label}</span>
          <span className="font-mono text-[8px] uppercase tracking-widest"
            style={{ color: STATUS_COLORS[item.status] }}>
            {item.status}
          </span>
        </motion.div>
      ))}
    </motion.div>
  )
}
