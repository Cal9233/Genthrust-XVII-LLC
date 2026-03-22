'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { progressBarFill } from '@/lib/animations'

interface ProgressBarProps {
  progress?: number // 0-100
  className?: string
  show?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  position?: 'top' | 'bottom'
}

export function ProgressBar({
  progress = 0,
  className,
  show = true,
  variant = 'default',
  position = 'top',
}: ProgressBarProps) {
  const variantColors = {
    default: 'bg-electric-blue',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-crimson',
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            'fixed left-0 right-0 z-[100] h-1 bg-slate-200/50',
            position === 'top' ? 'top-0' : 'bottom-0',
            className
          )}
        >
          <motion.div
            className={cn('h-full', variantColors[variant])}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Top loading bar (like Next.js router progress)
export function TopLoadingBar({ progress = 100 }: { progress?: number }) {
  return (
    <ProgressBar
      progress={progress}
      variant="default"
      position="top"
      className="h-0.5"
    />
  )
}
