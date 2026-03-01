'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface HUDOverlayProps {
  isActive: boolean
  className?: string
  showCornerBrackets?: boolean
  showScanLine?: boolean
  showStatus?: boolean
}

export function HUDOverlay({
  isActive,
  className,
  showCornerBrackets = true,
  showScanLine = true,
  showStatus = false,
}: HUDOverlayProps) {
  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
      {/* Corner Brackets */}
      {showCornerBrackets && (
        <>
          {/* Top-left bracket */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 0.4, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="absolute top-4 left-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-horizon-blue">
              <path d="M4 8V4h4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          {/* Top-right bracket */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 0.4, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="absolute top-4 right-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-horizon-blue">
              <path d="M16 4h4v4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          {/* Bottom-left bracket */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 0.4, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="absolute bottom-4 left-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-horizon-blue">
              <path d="M4 16v4h4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          {/* Bottom-right bracket */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isActive ? { opacity: 0.4, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="absolute bottom-4 right-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-horizon-blue">
              <path d="M20 16v4h-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </>
      )}

      {/* Scan Line */}
      {showScanLine && isActive && (
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-horizon-blue/40 to-transparent"
          initial={{ top: '0%', opacity: 0 }}
          animate={{
            top: ['0%', '100%', '0%'],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Status Indicator */}
      {showStatus && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-horizon-blue/60 font-mono text-[10px] uppercase tracking-widest"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-horizon-blue animate-pulse" />
          System Active
        </motion.div>
      )}
    </div>
  )
}
