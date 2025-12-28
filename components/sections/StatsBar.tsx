'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { STATS } from '@/lib/constants'

export function StatsBar() {
  return (
    <section className="relative py-16 bg-slate-50 border-y border-slate-200">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-electric-blue/5 to-transparent" />

      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 lg:gap-24"
        >
          {STATS.map((stat, index) => (
            <div key={stat.label} className="relative flex flex-col items-center text-center group">
              {/* Stat value */}
              <div className="flex items-baseline gap-1">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy group-hover:text-electric-blue transition-colors"
                />
              </div>

              {/* Label */}
              <p className="text-xs md:text-sm text-slate-500 uppercase tracking-widest mt-2">
                {stat.label}
              </p>

              {/* Separator (not on last item) */}
              {index < STATS.length - 1 && (
                <div className="hidden md:block absolute -right-8 lg:-right-12 top-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
