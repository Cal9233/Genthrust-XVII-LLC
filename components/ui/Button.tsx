'use client'

import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useState, MouseEvent } from 'react'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'outline' | 'outline-red'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

interface Ripple {
  x: number
  y: number
  id: number
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  icon,
  iconPosition = 'left',
  onClick,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])

  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold tracking-wide uppercase transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white rounded-lg overflow-hidden'

  const variants = {
    primary:
      'bg-electric-blue text-white hover:bg-electric-blue-600 hover:brightness-110 focus:ring-electric-blue shadow-lg hover:shadow-glow-blue transition-all',
    outline:
      'bg-transparent border-2 border-electric-blue text-electric-blue hover:bg-electric-blue/10 hover:shadow-glow-blue focus:ring-electric-blue transition-all',
    'outline-red':
      'bg-transparent border-2 border-crimson text-crimson hover:bg-crimson/10 hover:shadow-glow-crimson focus:ring-crimson transition-all',
  }

  const sizes = {
    sm: 'px-4 py-2 text-xs gap-2',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-3',
  }

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e)
    }

    // Create ripple effect
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newRipple: Ripple = {
      x,
      y,
      id: Date.now(),
    }

    setRipples((prev) => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
    }, 600)
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      onClick={handleClick}
      {...props}
    >
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              x: -10,
              y: -10,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{
              scale: 4,
              opacity: 0,
              transition: {
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
              },
            }}
            exit={{ opacity: 0 }}
          />
        ))}
      </AnimatePresence>

      {/* Icon and content */}
      <span className="relative z-10 flex items-center">
        {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
        {children}
        {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
      </span>
    </motion.button>
  )
}
