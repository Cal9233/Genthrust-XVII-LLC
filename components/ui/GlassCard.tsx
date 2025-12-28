'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { cardHover } from '@/lib/animations'

interface GlassCardProps {
  children: ReactNode
  className?: string
  featured?: boolean
  href?: string
}

export function GlassCard({ children, className, featured = false, href }: GlassCardProps) {
  const Component = href ? motion.a : motion.div

  return (
    <Component
      href={href}
      initial="rest"
      whileHover="hover"
      variants={cardHover}
      className={cn(
        'group relative overflow-hidden rounded-2xl cursor-pointer',
        'bg-white',
        'border border-slate-200',
        'shadow-card hover:shadow-card-hover',
        'hover:border-electric-blue/30',
        'transition-all duration-300',
        featured && 'md:col-span-2 md:row-span-2',
        className
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>
    </Component>
  )
}
