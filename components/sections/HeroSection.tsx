'use client'

import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'

export function HeroSection() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Background gradient layers - Light theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
      <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/5 via-transparent to-crimson/5" />

      {/* Subtle animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-electric-blue/5 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-crimson/5 rounded-full blur-3xl animate-float"
        style={{ animationDelay: '-3s' }}
      />

      {/* Grid pattern overlay - subtle on light */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(30,58,95,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,95,0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
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
          className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-6"
        >
          Aviation Brokerage Excellence
        </motion.p>

        {/* Main Headline */}
        <motion.h1
          variants={staggerItem}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-navy mb-6"
        >
          POWERING GLOBAL
          <br />
          <span className="text-electric-blue">
            AVIATION
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={staggerItem}
          className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10"
        >
          Your trusted partner for buying, selling, and repairing certified aircraft components.
        </motion.p>

        {/* Search Input */}
        <motion.div variants={staggerItem} className="max-w-2xl mx-auto mb-8">
          <SearchInput
            placeholder="Search Part Number, Keyword, or Aircraft Type..."
            containerClassName="mx-auto"
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

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-16 flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 border-2 border-slate-300 rounded-full flex justify-center pt-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-electric-blue rounded-full" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
