'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import dynamic from 'next/dynamic'
import LogoReveal from './LogoReveal'
import { AnamorphicFlare } from '@/components/ui/AnamorphicFlare'

const ParticleVertexAircraft = dynamic(
  () => import('@/components/ParticleVertexAircraft'),
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
  const [isMobile, setIsMobile] = useState(false)
  const [scrollVelocity, setScrollVelocity] = useState(0)
  const lastScrollY = useRef(0)
  const { scrollY } = useScroll()

  const finishIntro = useCallback(() => {
    setStage('complete')
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto'
    }
    onComplete?.()
  }, [onComplete])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isMobile) {
      finishIntro()
      return
    }

    if (stage !== 'complete' && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden'
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
  }, [stage, isMobile, finishIntro])

  useEffect(() => {
    if (isMobile || stage === 'complete') return

    const handleScroll = () => {
      finishIntro()
    }

    window.addEventListener('wheel', handleScroll, { passive: true })
    window.addEventListener('touchmove', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleScroll)
      window.removeEventListener('touchmove', handleScroll)
    }
  }, [stage, isMobile, finishIntro])

  // Track scroll velocity for particle streaks
  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    const updateVelocity = () => {
      const currentScrollY = window.scrollY
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime
      const deltaScroll = Math.abs(currentScrollY - lastScrollY.current)

      // Calculate velocity (pixels per second, normalized to 0-5 range)
      const velocity = deltaTime > 0 ? Math.min((deltaScroll / deltaTime) * 10, 5) : 0

      // Smooth the velocity with lerp
      setScrollVelocity((prev) => prev + (velocity - prev) * 0.1)

      lastScrollY.current = currentScrollY
      lastTime = currentTime
      rafId = requestAnimationFrame(updateVelocity)
    }

    rafId = requestAnimationFrame(updateVelocity)
    return () => cancelAnimationFrame(rafId)
  }, [])

  if (isMobile) {
    return (
      <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
        <LogoReveal isComplete={true} />
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-space overflow-hidden bg-noise">
      {/* Anamorphic Lens Flare */}
      <AnamorphicFlare />

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
            <ParticleVertexAircraft stage={stage} scrollVelocity={scrollVelocity} />
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
