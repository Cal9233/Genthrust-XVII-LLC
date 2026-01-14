'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { cardHover, liftEffect, imageZoom } from '@/lib/animations'

interface GlassCardProps {
  children: ReactNode
  className?: string
  featured?: boolean
  href?: string
  imageContainerClassName?: string
}

export function GlassCard({ children, className, featured = false, href, imageContainerClassName }: GlassCardProps) {
  const Component = href ? motion.a : motion.div

  return (
    <Component
      href={href}
      initial="rest"
      whileHover="hover"
      variants={cardHover}
      className={cn(
        'group relative overflow-hidden rounded-2xl cursor-pointer',
        'bg-white/98 backdrop-blur-md',
        'border border-slate-200/80',
        'shadow-card hover:shadow-card-hover',
        'hover:border-electric-blue/50',
        'transition-all duration-300',
        featured && 'md:col-span-2 md:row-span-2',
        className
      )}
    >
      {/* Enhanced gradient overlay on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-electric-blue/5 via-transparent to-transparent"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>
    </Component>
  )
}

// Helper component for image zoom effect inside cards
interface CardImageProps {
  children: ReactNode
  className?: string
}

export function CardImage({ children, className }: CardImageProps) {
  return (
    <motion.div
      variants={imageZoom}
      initial="rest"
      whileHover="hover"
      className={cn('overflow-hidden rounded-xl', className)}
    >
      {children}
    </motion.div>
  )
}
