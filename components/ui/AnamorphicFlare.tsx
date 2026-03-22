'use client'

import { useEffect, useRef, useCallback } from 'react'

interface AnamorphicFlareProps {
  className?: string
  opacity?: number
  disabled?: boolean
}

export function AnamorphicFlare({ className, opacity = 0.08, disabled = false }: AnamorphicFlareProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef({ x: 50, y: 50 })
  const targetRef = useRef({ x: 50, y: 50 })
  const animationRef = useRef<number | null>(null)

  const lerp = useCallback(() => {
    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.08
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.08

    // Update DOM directly — no React re-render per frame
    if (elRef.current) {
      elRef.current.style.background = `radial-gradient(
        circle 30% at ${currentRef.current.x}% ${currentRef.current.y}%,
        rgba(56, 178, 172, ${opacity}) 0%,
        rgba(255, 255, 255, ${opacity * 0.5}) 30%,
        transparent 70%
      )`
    }

    if (
      Math.abs(targetRef.current.x - currentRef.current.x) > 0.01 ||
      Math.abs(targetRef.current.y - currentRef.current.y) > 0.01
    ) {
      animationRef.current = requestAnimationFrame(lerp)
    } else {
      animationRef.current = null
    }
  }, [opacity])

  useEffect(() => {
    // Disable on touch devices — no hover cursor to follow
    if (disabled || ('ontouchstart' in window)) return

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
  }, [lerp, disabled])

  if (disabled) return null

  return (
    <div
      ref={elRef}
      className={`absolute inset-0 pointer-events-none z-40 ${className || ''}`}
    />
  )
}
