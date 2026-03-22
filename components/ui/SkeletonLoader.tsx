'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SkeletonLoaderProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animate?: boolean
}

export function SkeletonLoader({
  className,
  variant = 'rectangular',
  width,
  height,
  animate = true,
}: SkeletonLoaderProps) {
  const baseStyles = 'bg-slate-200 rounded'

  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }

  const animation = animate
    ? {
        opacity: [0.5, 1, 0.5],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: [0.4, 0, 0.6, 1] as const,
        },
      }
    : {}

  return (
    <motion.div
      animate={animation}
      className={cn(baseStyles, variantStyles[variant], className)}
      style={{
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? width : '1rem'),
      }}
    />
  )
}

interface SkeletonGroupProps {
  count?: number
  className?: string
  itemClassName?: string
  variant?: 'text' | 'circular' | 'rectangular'
}

export function SkeletonGroup({ count = 3, className, itemClassName, variant = 'text' }: SkeletonGroupProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonLoader key={index} variant={variant} className={itemClassName} />
      ))}
    </div>
  )
}
