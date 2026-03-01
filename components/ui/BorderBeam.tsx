'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface BorderBeamProps {
  children: ReactNode
  className?: string
  beamColor?: string
  duration?: number
  borderRadius?: string
}

export function BorderBeam({
  children,
  className,
  beamColor = 'rgba(56, 178, 172, 0.8)',
  duration = 4,
  borderRadius = '1rem',
}: BorderBeamProps) {
  return (
    <div
      className={cn('relative', className)}
      style={
        {
          '--beam-color': beamColor,
          '--beam-duration': `${duration}s`,
          '--border-radius': borderRadius,
        } as React.CSSProperties
      }
    >
      {/* Animated border beam */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius }}
      >
        <div
          className="absolute inset-[-1px] animate-border-beam"
          style={{
            borderRadius,
            background: `conic-gradient(from var(--beam-angle, 0deg), transparent 0%, transparent 75%, ${beamColor} 85%, transparent 95%)`,
            animation: `borderBeam ${duration}s linear infinite`,
          }}
        />
        {/* Inner mask to create border effect */}
        <div
          className="absolute inset-[1px] bg-space"
          style={{ borderRadius: `calc(${borderRadius} - 1px)` }}
        />
      </div>

      {/* Static border fallback */}
      <div
        className="absolute inset-0 border border-white/10 pointer-events-none"
        style={{ borderRadius }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
