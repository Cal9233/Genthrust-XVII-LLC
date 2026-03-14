'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'

// Re-exported for legacy consumers (ParticleVertexAircraft components)
export type IntroStage = 'loading' | 'assembling' | 'glowing' | 'revealing' | 'complete'
import { AnamorphicFlare } from '@/components/ui/AnamorphicFlare'
import { MagneticButton } from '@/components/ui/MagneticButton'
import { HUDOverlay } from './HUDOverlay'
import { ArcGauge, CompassRose, TelemetryTicker, StatusGrid } from './InstrumentCluster'
import { STATS } from '@/lib/constants'

// ── Topographic scan-line grid (CSS-only, no assets) ────────────────────────
function TopoGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Horizontal scan lines */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(56,178,172,0.6) 40px)',
        }}
      />
      {/* Vertical grid */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(56,178,172,0.6) 80px)',
        }}
      />
      {/* Center cross-hair — large */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[600px] h-[600px] opacity-[0.04]">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-horizon-blue" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-horizon-blue" />
          {/* Concentric rings */}
          {[80, 160, 260, 380].map((r) => (
            <div
              key={r}
              className="absolute rounded-full border border-horizon-blue/40"
              style={{
                width: r * 2,
                height: r * 2,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      </div>
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(2,6,23,0.7) 100%)',
        }}
      />
    </div>
  )
}

// ── Altitude tape (vertical strip on right edge) ─────────────────────────────
function AltitudeTape() {
  const ALT_BASE = 35000
  const ticks = Array.from({ length: 9 }, (_, i) => ALT_BASE - (i - 4) * 1000)

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-64 w-14 flex flex-col items-end justify-between pr-2 border-r border-horizon-blue/10">
      {ticks.map((alt, i) => (
        <div key={alt} className={`flex items-center gap-1.5 ${i === 4 ? 'opacity-100' : 'opacity-30'}`}>
          <span className="font-mono text-[8px] tracking-wider" style={{ color: i === 4 ? '#38B2AC' : 'rgba(255,255,255,0.5)' }}>
            {(alt / 1000).toFixed(0)}K
          </span>
          <div className={`h-px ${i === 4 ? 'w-4 bg-horizon-blue' : 'w-2 bg-white/30'}`} />
        </div>
      ))}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-horizon-blue rounded-l"
        style={{ boxShadow: '0 0 6px #38B2AC' }} />
    </div>
  )
}

// ── Heading strip (horizontal, top edge) ─────────────────────────────────────
function HeadingStrip() {
  const HDG_BASE = 247
  const ticks = Array.from({ length: 13 }, (_, i) => ((HDG_BASE - 60 + i * 10) + 360) % 360)

  const hdgLabel = (hdg: number) => {
    if (hdg === 0)   return 'N'
    if (hdg === 90)  return 'E'
    if (hdg === 180) return 'S'
    if (hdg === 270) return 'W'
    return String(hdg)
  }

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-10 flex items-end justify-between px-1 border-b border-horizon-blue/10 overflow-hidden">
      {ticks.map((hdg, i) => {
        const isCurrent  = i === 6
        const isCardinal = hdg % 90 === 0
        return (
          <div key={hdg} className="flex flex-col items-center gap-0.5">
            {(isCurrent || isCardinal) && (
              <span className="font-mono text-[7px]" style={{ color: isCurrent ? '#38B2AC' : 'rgba(255,255,255,0.3)' }}>
                {hdgLabel(hdg)}
              </span>
            )}
            <div className={`w-px ${isCurrent ? 'h-3 bg-horizon-blue' : isCardinal ? 'h-2 bg-white/30' : 'h-1 bg-white/15'}`} />
          </div>
        )
      })}
      {/* Lubber line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-3.5 bg-horizon-blue"
        style={{ boxShadow: '0 0 4px #38B2AC' }} />
    </div>
  )
}

// ── Left instrument panel ─────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col gap-4 w-40 flex-shrink-0"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="w-1 h-3 bg-horizon-blue rounded-full" style={{ boxShadow: '0 0 4px #38B2AC' }} />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Systems</span>
      </div>

      <div className="flex gap-4 justify-center">
        <ArcGauge value={94} label="Capacity" unit="PCT" color="#38B2AC" size={76} delay={0.5} />
        <ArcGauge value={72} label="Throughput" unit="KTS" color="#1e4a8d" size={76} delay={0.65} />
      </div>

      <StatusGrid delay={0.9} />
      <TelemetryTicker delay={1.2} />
    </motion.div>
  )
}

// ── Coordinate readout row ────────────────────────────────────────────────────
interface CoordLineProps {
  label: string
  value: string
  color?: string
}

function CoordLine({ label, value, color }: CoordLineProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[8px] text-white/25 uppercase tracking-wider">{label}</span>
      <span
        className="font-mono text-[9px] tracking-wider"
        style={{ color: color ?? 'rgba(255,255,255,0.5)' }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Right instrument panel ─────────────────────────────────────────────────────
function RightPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col gap-4 w-40 flex-shrink-0"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="w-1 h-3 bg-burgundy-600 rounded-full" style={{ boxShadow: '0 0 4px #9c2a3e' }} />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Navigation</span>
      </div>

      <div className="flex justify-center">
        <CompassRose heading={247} delay={0.6} />
      </div>

      <div className="border border-white/[0.06] rounded bg-white/[0.02] p-2 space-y-1">
        <CoordLine label="LAT" value={`25\u00b048'31"N`} />
        <CoordLine label="LON" value={`80\u00b021'21"W`} />
        <CoordLine label="ALT" value="35,000 FT" color="#38B2AC" />
        <CoordLine label="GS"  value="487 KTS" />
      </div>

      <div className="border border-white/[0.06] rounded bg-white/[0.02] p-2">
        <div className="font-mono text-[8px] text-white/25 uppercase tracking-widest mb-1.5">Active Freq</div>
        <div className="font-mono text-sm text-horizon-blue tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
          121.500
        </div>
        <div className="font-mono text-[8px] text-white/25 mt-0.5">GUARD · EMERGENCY</div>
      </div>
    </motion.div>
  )
}

// ── Center display ────────────────────────────────────────────────────────────
function CenterDisplay({ scrollY }: { scrollY: ReturnType<typeof useScroll>['scrollY'] }) {
  const logoY   = useTransform(scrollY, [0, 400], [0, -60])
  const textY   = useTransform(scrollY, [0, 400], [0, -120])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const isTouchRef = useRef(false)

  useEffect(() => {
    isTouchRef.current = 'ontouchstart' in window
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isTouchRef.current) return
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setMousePosition({
      x: (e.clientX - cx) / cx,
      y: (e.clientY - cy) / cy,
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const logoTransform = isTouchRef.current
    ? ''
    : `perspective(1200px) rotateY(${mousePosition.x * 3}deg) rotateX(${-mousePosition.y * 3}deg)`

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative min-w-0">
      <HeadingStrip />
      <AltitudeTape />

      {/* Logo */}
      <motion.div style={{ y: logoY }} className="relative z-10 pb-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-4 sm:p-6"
          style={{
            transform: logoTransform,
            transition: 'transform 0.12s ease-out',
          }}
        >
          <HUDOverlay isActive showStatus />
          <Image
            src="/GenLogoNoBackground.png"
            alt="GENTHRUST XVII Logo"
            width={600}
            height={345}
            priority
            className="w-full max-w-[min(38rem,82vw)] h-auto object-contain relative z-10"
            style={{ filter: 'drop-shadow(0 0 14px rgba(56,178,172,0.28))' }}
          />
        </motion.div>
      </motion.div>

      {/* Typography + CTAs */}
      <motion.div
        style={{ y: textY, opacity }}
        className="text-center px-4 z-10 pointer-events-auto"
      >
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-3 leading-none"
        >
          <span className="text-chrome">Precision Aviation</span>
          <span className="text-silver/60 font-light"> Sourcing</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="text-base sm:text-lg text-silver/50 max-w-md mx-auto mb-7"
        >
          Same day delivery · Competitive pricing · 25+ years AOG expertise
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
        >
          <MagneticButton
            variant="primary"
            size="lg"
            onClick={() => document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Search Inventory
          </MagneticButton>
          <MagneticButton
            variant="outline-horizon"
            size="lg"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Request Quote
          </MagneticButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.78 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1"
        >
          {STATS.map((stat, i) => (
            <span key={stat.label} className="flex items-center gap-x-6">
              <span className="font-mono text-xs text-silver/40 tracking-wider">
                <span className="text-silver/60 font-semibold">{stat.value}</span>{' '}
                {stat.label}
              </span>
              {i < STATS.length - 1 && (
                <span className="hidden sm:inline text-silver/15">|</span>
              )}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.a
        href="#search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-silver/30 hover:text-silver/60 transition-colors"
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </motion.a>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
interface HeroIntroProps {
  onComplete?: () => void
}

export default function HeroIntro({ onComplete }: HeroIntroProps) {
  const { scrollY } = useScroll()

  useEffect(() => {
    // No staged intro sequence — hero is immediately visible
    onComplete?.()
  }, [onComplete])

  return (
    <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
      <TopoGrid />
      <AnamorphicFlare opacity={0.07} />

      {/* Subtle navy glow at bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70vw] h-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(30,74,141,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Three-column cockpit layout */}
      <div className="relative z-10 h-full flex items-center gap-6 px-4 sm:px-8 max-w-[1400px] mx-auto">
        <LeftPanel />
        <CenterDisplay scrollY={scrollY} />
        <RightPanel />
      </div>
    </div>
  )
}
