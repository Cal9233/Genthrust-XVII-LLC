'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useScroll } from 'framer-motion'
import dynamic from 'next/dynamic'
import LogoReveal from './LogoReveal'
import { AnamorphicFlare } from '@/components/ui/AnamorphicFlare'
import { useWebGLCapabilities } from '@/hooks/useWebGLCapabilities'

const ParticleVertexAircraft = dynamic(
  () => import('@/components/ParticleVertexAircraft'),
  {
    ssr: false,
    loading: () => null
  }
)

const Canvas2DFallback = dynamic(
  () => import('@/components/ParticleVertexAircraft/Canvas2DFallback'),
  {
    ssr: false,
    loading: () => null
  }
)

export type IntroStage = 'loading' | 'assembling' | 'glowing' | 'revealing' | 'complete'

interface HeroIntroProps {
  onComplete?: () => void
}

export default function HeroIntro({ onComplete }: HeroIntroProps) {
  const [stage, setStage] = useState<IntroStage>('loading')
  const [scrollVelocity, setScrollVelocity] = useState(0)
  const lastScrollY = useRef(0)
  const { scrollY } = useScroll()
  const capabilities = useWebGLCapabilities()

  const finishIntro = useCallback(() => {
    setStage('complete')
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('scroll-locked')
    }
    onComplete?.()
  }, [onComplete])

  // Cleanup scroll lock on unmount
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('scroll-locked')
    }
  }, [])

  // Stage progression — only for WebGL tiers (1-3)
  useEffect(() => {
    if (capabilities.tier === 0) {
      // Tier 0: Canvas2D handles its own assembly, or CSS fallback
      return
    }

    if (stage !== 'complete' && typeof document !== 'undefined') {
      document.documentElement.classList.add('scroll-locked')
    }

    let timer: NodeJS.Timeout

    switch (stage) {
      case 'loading':
        timer = setTimeout(() => setStage('assembling'), 100)
        break
      case 'assembling':
        timer = setTimeout(() => setStage('glowing'), 1800)
        break
      case 'glowing':
        timer = setTimeout(() => setStage('revealing'), 300)
        break
      case 'revealing':
        timer = setTimeout(() => finishIntro(), 600)
        break
    }

    return () => clearTimeout(timer)
  }, [stage, capabilities.tier, finishIntro])

  // Scroll-to-skip — skip animation on any scroll/touch
  useEffect(() => {
    if (stage === 'complete') return

    const handleScroll = () => {
      finishIntro()
    }

    window.addEventListener('wheel', handleScroll, { passive: true })
    window.addEventListener('touchmove', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleScroll)
      window.removeEventListener('touchmove', handleScroll)
    }
  }, [stage, finishIntro])

  // Track scroll velocity for particle streaks (only for tiers 2+)
  useEffect(() => {
    if (capabilities.tier < 2) return

    let rafId: number
    let lastTime = performance.now()

    const updateVelocity = () => {
      const currentScrollY = window.scrollY
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime
      const deltaScroll = Math.abs(currentScrollY - lastScrollY.current)

      const velocity = deltaTime > 0 ? Math.min((deltaScroll / deltaTime) * 10, 5) : 0
      setScrollVelocity((prev) => prev + (velocity - prev) * 0.1)

      lastScrollY.current = currentScrollY
      lastTime = currentTime
      rafId = requestAnimationFrame(updateVelocity)
    }

    rafId = requestAnimationFrame(updateVelocity)
    return () => cancelAnimationFrame(rafId)
  }, [capabilities.tier])

  // Tier 0: Canvas 2D fallback or CSS-only fallback
  if (capabilities.tier === 0) {
    if (capabilities.supportsWebGL) {
      // Canvas 2D assembling animation
      return (
        <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
          <Canvas2DFallback
            onAssembled={() => {
              setTimeout(() => finishIntro(), 300)
            }}
          />
          <AnimatePresence>
            {stage === 'complete' && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-20"
              >
                <LogoReveal isComplete={true} scrollY={scrollY} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }

    // No WebGL at all: CSS-only fade with static logo
    return (
      <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
        <LogoReveal isComplete={true} />
      </div>
    )
  }

  // Tiers 1-3: Full R3F particle system with adaptive quality
  return (
    <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
      {/* Anamorphic Lens Flare — disabled on Tier 1 */}
      <AnamorphicFlare disabled={capabilities.tier < 2} />

      {/* Stage 1-2: 3D Particle Canvas */}
      <AnimatePresence mode="wait">
        {(stage === 'loading' || stage === 'assembling' || stage === 'glowing') && (
          <motion.div
            key="particles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10"
          >
            <ParticleVertexAircraft
              stage={stage}
              scrollVelocity={scrollVelocity}
              initialParticleCount={capabilities.particleCount}
              initialDpr={capabilities.maxDpr > 1.5 ? 1.5 : capabilities.maxDpr}
              maxDpr={capabilities.maxDpr}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 3-4: The PNG Reveal */}
      <AnimatePresence>
        {(stage === 'revealing' || stage === 'complete') && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-20"
          >
            <LogoReveal isComplete={stage === 'complete'} scrollY={scrollY} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip hint */}
      {stage !== 'complete' && stage !== 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 text-silver/50 text-xs uppercase tracking-widest font-mono"
        >
          Scroll to skip
        </motion.div>
      )}
    </div>
  )
}
