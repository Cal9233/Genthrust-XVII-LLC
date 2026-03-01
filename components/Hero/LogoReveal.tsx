'use client'

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { HUDOverlay } from './HUDOverlay'
import { MagneticButton } from '@/components/ui/MagneticButton'

interface LogoRevealProps {
  isComplete: boolean
  scrollY?: MotionValue<number>
}

export default function LogoReveal({ isComplete, scrollY }: LogoRevealProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Fallback scroll if not provided
  const { scrollY: fallbackScrollY } = useScroll()
  const activeScrollY = scrollY || fallbackScrollY

  // Z-axis parallax transforms for spatial depth
  const layer1Y = useTransform(activeScrollY, [0, 500], [0, -100])  // Logo - medium speed
  const layer2Y = useTransform(activeScrollY, [0, 500], [0, -200])  // HUD/Text - fastest

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isTouchDevice) return
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    setMousePosition({
      x: (e.clientX - centerX) / centerX,  // -1 to 1
      y: (e.clientY - centerY) / centerY   // -1 to 1
    })
  }, [isTouchDevice])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Calculate 3D mouse parallax for logo
  const logoTransform = isTouchDevice
    ? ''
    : `perspective(1000px) rotateY(${mousePosition.x * 5}deg) rotateX(${-mousePosition.y * 5}deg)`

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Horizon lines effect - subtle overlay */}
      <div className="horizon-lines opacity-50" />

      {/* Background glow effect - adjusted for dark theme */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isComplete ? 0.06 : 0.12, scale: 1.2 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-[500px] h-[500px] bg-horizon-blue rounded-full blur-[120px]"
        />
      </div>

      {/* LAYER 1: Logo with glassmorphism - positioned at top (Z-index 10) */}
      <motion.div
        style={{ y: layer1Y }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-[22rem] z-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="glass-card p-4 sm:p-6 md:p-8"
          style={{
            transform: logoTransform,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <HUDOverlay isActive={isComplete} showStatus />
          <Image
            src="/GenLogoNoBackground.png"
            alt="GENTHRUST XVII Logo"
            width={720}
            height={414}
            priority
            className="w-[40rem] sm:w-[44rem] md:w-[48.67rem] h-auto object-contain relative z-10"
            style={{
              filter: `drop-shadow(0 0 ${isComplete ? '16px' : '24px'} rgba(56, 178, 172, ${isComplete ? 0.3 : 0.5}))`,
              transition: 'filter 0.4s ease-out'
            }}
          />
        </motion.div>
      </motion.div>

      {/* LAYER 2: Typography - positioned at bottom (Z-index 20, moves fastest) */}
      <motion.div
        style={{ y: layer2Y }}
        className="absolute bottom-0 left-0 right-0 pb-16 z-20"
      >
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={isComplete ? { opacity: 1, y: 0 } : { opacity: 0, y: 25 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="text-center pointer-events-auto px-4"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">
            <span className="text-chrome">Precision Aviation</span>
            <span className="text-silver/70 font-normal"> Sourcing</span>
          </h1>
          <p className="text-sm text-silver/60 max-w-md mx-auto mb-5">
            Same day delivery, competitive pricing, and 25+ years of experience.
          </p>

          {/* CTAs with MagneticButtons */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={isComplete ? { y: 0, opacity: 1 } : { y: 10, opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <MagneticButton
              variant="primary"
              size="md"
              onClick={() => {
                document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Search Inventory
            </MagneticButton>
            <MagneticButton
              variant="outline-horizon"
              size="md"
              onClick={() => {
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Request Quote
            </MagneticButton>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isComplete ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
      >
        <a
          href="#search"
          className="flex flex-col items-center gap-1 text-silver/40 hover:text-silver transition-colors pointer-events-auto"
        >
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </a>
      </motion.div>
    </div>
  )
}
