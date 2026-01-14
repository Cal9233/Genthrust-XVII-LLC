'use client'

import { motion } from 'framer-motion'
import { Shield, Clock, Globe, Award } from 'lucide-react'
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/animations'
import { ADVANTAGES, PARTNER_LOGOS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const iconMap = {
  Shield,
  Clock,
  Globe,
  Award,
}

export function WhyGenthrust() {
  return (
    <section className="relative py-28 bg-gradient-to-b from-dark-charcoal-300 via-dark-charcoal-200 to-dark-charcoal-300 overflow-hidden">
      {/* Enhanced background elements */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-crimson/10 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute inset-0 bg-gradient-electric-vertical opacity-30" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-electric-blue-300 uppercase tracking-[0.3em] text-sm font-medium mb-4">
            The GENTHRUST Advantage
          </p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4">
            <span className="text-electric-blue-400">BUILT ON SPEED.</span>
            <br />
            <span className="text-white">FORGED IN TRUST.</span>
          </h2>
        </motion.div>

        {/* Advantages Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24"
        >
          {ADVANTAGES.map((advantage) => {
            const Icon = iconMap[advantage.icon as keyof typeof iconMap]

            return (
              <motion.div
                key={advantage.title}
                variants={staggerItem}
                className="group relative p-8 rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-electric-blue/25 hover:border-electric-blue/50 transition-all duration-300"
              >
                {/* Icon */}
                <div className="relative w-16 h-16 rounded-xl bg-electric-blue/25 flex items-center justify-center mb-6 group-hover:bg-electric-blue/35 transition-all duration-300">
                  <Icon className="w-8 h-8 text-electric-blue-400 group-hover:scale-110 transition-transform duration-300" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-extrabold text-white mb-3 group-hover:text-electric-blue-300 transition-colors">{advantage.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{advantage.description}</p>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Partner Logos Carousel */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative"
        >
          <p className="text-center text-slate-400 uppercase tracking-widest text-sm mb-10 font-medium">
            Trusted By Industry Leaders
          </p>

          {/* Logo carousel container */}
          <div className="relative overflow-hidden">
            {/* Gradient masks */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-dark-charcoal-300 to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-dark-charcoal-300 to-transparent z-10" />

            {/* Scrolling logos */}
            <motion.div
              animate={{ x: [0, -1000] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: 'loop',
                  duration: 20,
                  ease: 'linear',
                },
              }}
              className="flex items-center gap-16"
            >
              {/* Duplicate logos for seamless loop */}
              {[...PARTNER_LOGOS, ...PARTNER_LOGOS].map((partner, index) => (
                <div
                  key={`${partner.name}-${index}`}
                  className={cn(
                    'flex-shrink-0 w-32 h-16',
                    'bg-slate-800/50 backdrop-blur-sm rounded-lg border border-electric-blue/20',
                    'flex items-center justify-center',
                    'opacity-60 hover:opacity-100 hover:border-electric-blue/40 transition-all',
                    'shadow-sm hover:shadow-glow-blue'
                  )}
                >
                  <span className="text-slate-300 text-xs text-center px-2">{partner.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
