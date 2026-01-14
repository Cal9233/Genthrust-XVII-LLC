'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

interface ParticleBackgroundProps {
  particleCount?: number
  className?: string
  color?: string
  speed?: 'slow' | 'medium' | 'fast'
}

export function ParticleBackground({
  particleCount = 50,
  className,
  color = 'rgba(0, 85, 184, 0.3)',
  speed = 'medium',
}: ParticleBackgroundProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const speedMultiplier = {
      slow: 20,
      medium: 15,
      fast: 10,
    }

    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: speedMultiplier[speed] + Math.random() * 10,
      delay: Math.random() * 2,
    }))

    setParticles(newParticles)
  }, [particleCount, speed])

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: color,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, (particle.id % 20) - 10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
