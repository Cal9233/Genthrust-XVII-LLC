'use client'

import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { ArrowDown } from 'lucide-react'

// Dynamic import for 3D component - only on desktop
const ParticleVertexAircraft = dynamic(
  () => import('@/components/ParticleVertexAircraft'),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 skeleton rounded-full" />
      </div>
    )
  }
)

export function HeroSection() {
  return (
    <section className="relative min-h-[500px] sm:min-h-[600px] max-h-[80vh] h-screen w-full overflow-hidden flex items-center">
      {/* Dark navy background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900" />

      {/* 3D Component - Desktop only */}
      <div className="absolute inset-0 hidden md:block">
        <ParticleVertexAircraft />
      </div>

      {/* Mobile fallback gradient */}
      <div className="absolute inset-0 md:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-burgundy-600/20 rounded-full blur-3xl" />
      </div>

      {/* Content overlay - renders immediately */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-24 pb-12">
        <div className="max-w-3xl">
          {/* Pre-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-burgundy-400 uppercase tracking-[0.2em] text-xs font-medium mb-4"
          >
            Premium Aviation Components
          </motion.p>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-6"
          >
            Precision Aviation
            <br />
            <span className="text-slate-400">Sourcing</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-slate-300 max-w-xl mb-8"
          >
            Supplying aircraft parts and components of the highest quality.
            Same day delivery, competitive pricing, and 25+ years of experience.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a
              href="#search"
              className="inline-flex items-center justify-center px-6 py-3 bg-burgundy-600 hover:bg-burgundy-700 text-white font-semibold rounded transition-colors"
            >
              Search Inventory
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center px-6 py-3 border border-white/30 hover:bg-white/10 text-white font-medium rounded transition-colors"
            >
              Request Quote
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <a href="#search" className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <span className="text-xs uppercase tracking-wider">Explore</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="w-4 h-4" />
          </motion.div>
        </a>
      </motion.div>

      {/* Bottom gradient fade to white (next section) */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  )
}
