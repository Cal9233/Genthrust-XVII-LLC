'use client'

import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { STATS } from '@/lib/constants'

export function StatsBar() {
  return (
    <section className="relative py-20 bg-gradient-to-r from-midnight-blue-200 via-dark-charcoal-200 to-midnight-blue-200 border-y border-electric-blue/20 dark-theme-section">
      {/* Enhanced gradient overlays */}
      <div className="absolute inset-0 bg-gradient-electric opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-electric-blue/15 to-transparent" />
      <div className="absolute inset-0 bg-gradient-radial from-electric-blue/10 via-transparent to-transparent" />

      {/* Subtle animated particles */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/2 left-1/4 w-64 h-64 bg-electric-blue/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
        className="absolute bottom-1/2 right-1/4 w-64 h-64 bg-electric-blue/10 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col md:flex-row justify-center items-center gap-12 md:gap-20 lg:gap-32"
        >
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="relative flex flex-col items-center text-center group"
            >
              {/* Glow effect on hover */}
              <div className="absolute -inset-4 bg-electric-blue/0 group-hover:bg-electric-blue/10 rounded-full blur-2xl transition-all duration-500" />
              
              {/* Stat value */}
              <div className="flex items-baseline gap-1 relative">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  className="text-6xl md:text-7xl lg:text-8xl font-extrabold text-white group-hover:text-electric-blue-300 transition-all duration-300"
                />
              </div>

              {/* Label */}
              <p className="text-base md:text-lg text-slate-200 uppercase tracking-wider mt-5 font-semibold">
                {stat.label}
              </p>

              {/* Enhanced separator (not on last item) */}
              {index < STATS.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="hidden md:block absolute -right-10 lg:-right-16 top-1/2 -translate-y-1/2 w-px h-20 bg-gradient-to-b from-transparent via-electric-blue/50 to-transparent"
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
