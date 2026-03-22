'use client'

import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useState, useRef, useCallback, useEffect, MouseEvent } from 'react'

interface MagneticButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'outline' | 'outline-horizon'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  magneticStrength?: number
  maxDisplacement?: number
}

interface Ripple {
  x: number
  y: number
  id: number
}

export function MagneticButton({
  className,
  variant = 'primary',
  size = 'md',
  children,
  icon,
  iconPosition = 'left',
  onClick,
  magneticStrength = 0.15,
  maxDisplacement = 12,
  ...props
}: MagneticButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isScanning, setIsScanning] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const animationRef = useRef<number | null>(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const isTouchDevice = useRef(false)

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window
  }, [])

  const lerp = useCallback(() => {
    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * magneticStrength
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * magneticStrength

    setPosition({ x: currentRef.current.x, y: currentRef.current.y })

    if (
      Math.abs(targetRef.current.x - currentRef.current.x) > 0.1 ||
      Math.abs(targetRef.current.y - currentRef.current.y) > 0.1
    ) {
      animationRef.current = requestAnimationFrame(lerp)
    }
  }, [magneticStrength])

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (isTouchDevice.current || !buttonRef.current) return

      const rect = buttonRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const deltaX = e.clientX - centerX
      const deltaY = e.clientY - centerY

      targetRef.current = {
        x: Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaX * 0.3)),
        y: Math.max(-maxDisplacement, Math.min(maxDisplacement, deltaY * 0.3)),
      }

      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(lerp)
      }
    },
    [lerp, maxDisplacement]
  )

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 }
    if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(lerp)
    }
  }, [lerp])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold tracking-wide uppercase transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-space rounded-lg overflow-hidden'

  const variants = {
    primary:
      'bg-aviation-red text-white hover:bg-aviation-red/90 hover:brightness-110 focus:ring-aviation-red shadow-lg hover:shadow-aviation-red/25 transition-all',
    outline:
      'bg-transparent border-2 border-silver/30 text-silver hover:bg-silver/10 hover:border-silver/50 focus:ring-silver transition-all',
    'outline-horizon':
      'bg-transparent border-2 border-horizon-blue/50 text-horizon-blue hover:bg-horizon-blue/10 hover:border-horizon-blue focus:ring-horizon-blue transition-all',
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

    // Trigger scan effect
    setIsScanning(true)
    setTimeout(() => setIsScanning(false), 600)

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

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
    }, 600)
  }

  return (
    <motion.button
      ref={buttonRef}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Scan line effect */}
      <AnimatePresence>
        {isScanning && (
          <motion.span
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-horizon-blue to-transparent pointer-events-none"
            initial={{ top: '0%', opacity: 1 }}
            animate={{ top: '100%', opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

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
