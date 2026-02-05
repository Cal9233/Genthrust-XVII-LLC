'use client'

import { motion } from 'framer-motion'
import { STATS } from '@/lib/constants'
import { fadeInUp, staggerGrid, staggerItem } from '@/lib/animations'

export function StatsBar() {
  return (
    <section className="relative py-16 bg-gradient-to-r from-electric-blue to-electric-blue-600">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          variants={staggerGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-white/80 text-sm md:text-base font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
