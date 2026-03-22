'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ShimmerProps {
  className?: string
  children?: React.ReactNode
  width?: string | number
  height?: string | number
}

export function Shimmer({ className, children, width, height }: ShimmerProps) {
  if (children) {
    // Shimmer effect on children (for loading states)
    return (
      <motion.div
        className={cn('relative overflow-hidden', className)}
        style={{ width, height }}
      >
        {children}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['-200% 0', '200% 0'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>
    )
  }

  // Standalone shimmer box
  return (
    <motion.div
      className={cn(
        'rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200',
        'bg-[length:200%_100%]',
        className
      )}
      style={{ width: width || '100%', height: height || '1rem' }}
      animate={{
        backgroundPosition: ['-200% 0', '200% 0'],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  )
}
