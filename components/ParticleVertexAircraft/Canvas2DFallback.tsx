'use client'

import { useRef, useEffect, useState } from 'react'

interface Particle {
  x: number
  y: number
  targetX: number
  targetY: number
  r: number
  g: number
  b: number
  size: number
}

interface Canvas2DFallbackProps {
  imagePath?: string
  particleCount?: number
  onAssembled?: () => void
}

export default function Canvas2DFallback({
  imagePath = '/GenLogoNoBackground.png',
  particleCount = 300,
  onAssembled,
}: Canvas2DFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [assembled, setAssembled] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas to fill container
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }
    resize()
    window.addEventListener('resize', resize)

    // Load and sample the logo image
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const offscreen = document.createElement('canvas')
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) return

      offscreen.width = img.width
      offscreen.height = img.height
      offCtx.drawImage(img, 0, 0)

      const imageData = offCtx.getImageData(0, 0, img.width, img.height)
      const data = imageData.data
      const validPixels: { x: number; y: number; r: number; g: number; b: number }[] = []

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3]
          if (a >= 128 && !(r > 240 && g > 240 && b > 240)) {
            validPixels.push({ x, y, r, g, b })
          }
        }
      }

      if (validPixels.length === 0) return

      // Scale logo to fit canvas (centered, 60% of width)
      const logoScale = (canvas.width * 0.6) / img.width
      const offsetX = (canvas.width - img.width * logoScale) / 2
      const offsetY = (canvas.height - img.height * logoScale) / 2

      // Create particles
      const particles: Particle[] = []
      for (let i = 0; i < particleCount; i++) {
        const pixel = validPixels[Math.floor(Math.random() * validPixels.length)]
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          targetX: pixel.x * logoScale + offsetX,
          targetY: pixel.y * logoScale + offsetY,
          r: Math.min(pixel.r * 1.15, 255),
          g: Math.min(pixel.g * 1.15, 255),
          b: Math.min(pixel.b * 1.15, 255),
          size: 1.5 + Math.random() * 1.5,
        })
      }

      // Animation loop
      const startTime = performance.now()
      const duration = 1800 // ms, match R3F version
      let animId: number
      let hasNotified = false

      const animate = () => {
        const elapsed = performance.now() - startTime
        const rawProgress = Math.min(elapsed / duration, 1)
        // easeOutCubic
        const progress = 1 - Math.pow(1 - rawProgress, 3)

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Additive blending simulation
        ctx.globalCompositeOperation = 'lighter'

        for (const p of particles) {
          const x = p.x + (p.targetX - p.x) * progress
          const y = p.y + (p.targetY - p.y) * progress

          // Floating effect during assembly
          const floatAmount = (1 - progress) * 3
          const floatX = x + Math.sin(elapsed * 0.002 + p.x * 0.01) * floatAmount
          const floatY = y + Math.cos(elapsed * 0.0015 + p.y * 0.008) * floatAmount

          const alpha = 0.3 + progress * 0.7
          ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`
          ctx.beginPath()
          ctx.arc(floatX, floatY, p.size * window.devicePixelRatio, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalCompositeOperation = 'source-over'

        if (rawProgress < 1) {
          animId = requestAnimationFrame(animate)
        } else if (!hasNotified) {
          hasNotified = true
          setAssembled(true)
          onAssembled?.()
        }
      }

      animId = requestAnimationFrame(animate)

      return () => {
        cancelAnimationFrame(animId)
      }
    }

    img.src = imagePath

    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [imagePath, particleCount, onAssembled])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#020617' }}
    />
  )
}
