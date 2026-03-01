'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AnamorphicFlareProps {
  className?: string
  opacity?: number
}

export function AnamorphicFlare({ className, opacity = 0.08 }: AnamorphicFlareProps) {
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const currentRef = useRef({ x: 50, y: 50 })
  const targetRef = useRef({ x: 50, y: 50 })
  const animationRef = useRef<number | null>(null)

  const lerp = useCallback(() => {
    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08

    setPosition({ x: currentRef.current.x, y: currentRef.current.y })

    if (
      Math.abs(targetRef.current.x - currentRef.current.x) > 0.01 ||
      Math.abs(targetRef.current.y - currentRef.current.y) > 0.01
    ) {
      animationRef.current = requestAnimationFrame(lerp)
    } else {
      animationRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      }

      if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(lerp)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [lerp])

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-40 ${className || ''}`}
      style={{
        background: `radial-gradient(
          circle 30% at ${position.x}% ${position.y}%,
          rgba(56, 178, 172, ${opacity}) 0%,
          rgba(255, 255, 255, ${opacity * 0.5}) 30%,
          transparent 70%
        )`,
      }}
    />
  )
}
