'use client'

import { motion } from 'framer-motion'
import { Plane } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'

export function HeroSection() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center dark-theme-section">
      {/* Background gradient layers - Dark theme */}
      <div className="absolute inset-0 bg-gradient-hero-dark" />
      <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/10 via-transparent to-electric-blue/5" />

      {/* Cinematic gradient overlays */}
      <div className="absolute inset-0 bg-gradient-radial from-electric-blue/5 via-transparent to-transparent" />
      <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-electric-blue/5 to-transparent" />
      <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-electric-blue/5 to-transparent" />

      {/* Animated atmospheric orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-electric-blue/20 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-electric-blue/15 rounded-full blur-3xl animate-float"
        style={{ animationDelay: '-3s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-electric-blue/10 rounded-full blur-3xl animate-pulse-glow"
      />

      {/* Subtle technical pattern overlay - like Turbo's line-art */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,85,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,85,184,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 container mx-auto px-4 md:px-6 pt-20 pb-12 text-center"
      >
        {/* Pre-headline */}
        <motion.p
          variants={staggerItem}
          className="text-electric-blue-300 uppercase tracking-[0.3em] text-sm font-medium mb-6"
        >
          Aviation Brokerage Excellence
        </motion.p>

        {/* Main Headline - Split Color Pattern */}
        <motion.h1
          variants={staggerItem}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6"
        >
          <span className="text-electric-blue-400">POWERING</span>
          <br />
          <span className="text-white">GLOBAL AVIATION</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={staggerItem}
          className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10"
        >
          Your trusted partner for buying, selling, and repairing certified aircraft components.
        </motion.p>

        {/* Search Input */}
        <motion.div variants={staggerItem} className="max-w-2xl mx-auto mb-8">
          <SearchInput
            placeholder="Search Part Number, Keyword, or Aircraft Type..."
            containerClassName="mx-auto"
            dark={true}
          />
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center"
        >
          <Button variant="primary" size="lg">
            Search Inventory
          </Button>
          <Button variant="outline-red" size="lg">
            Request a Repair
          </Button>
        </motion.div>

        {/* Scroll indicator - Airplane */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-16 flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-electric-blue-400"
          >
            <Plane className="w-6 h-6 rotate-90 shadow-glow-blue" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
