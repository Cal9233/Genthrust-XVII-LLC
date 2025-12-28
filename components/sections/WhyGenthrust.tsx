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
    <section className="relative py-24 bg-slate-50 overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-electric-blue/5 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-crimson/5 rounded-full blur-3xl -translate-y-1/2" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
            The GENTHRUST Advantage
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy mb-4">
            BUILT ON SPEED.
            <br />
            <span className="bg-gradient-to-r from-crimson to-crimson-500 bg-clip-text text-transparent">
              FORGED IN TRUST.
            </span>
          </h2>
        </motion.div>

        {/* Advantages Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          {ADVANTAGES.map((advantage) => {
            const Icon = iconMap[advantage.icon as keyof typeof iconMap]

            return (
              <motion.div
                key={advantage.title}
                variants={staggerItem}
                className="group relative p-6 rounded-2xl bg-white border border-slate-200 hover:border-electric-blue/30 hover:shadow-lg transition-all duration-300"
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-electric-blue/10 flex items-center justify-center mb-5 group-hover:bg-electric-blue/20 transition-colors">
                  <Icon className="w-7 h-7 text-electric-blue" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-navy mb-2">{advantage.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{advantage.description}</p>
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
          <p className="text-center text-slate-500 uppercase tracking-widest text-xs mb-8">
            Trusted By Industry Leaders
          </p>

          {/* Logo carousel container */}
          <div className="relative overflow-hidden">
            {/* Gradient masks */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-50 to-transparent z-10" />

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
                    'bg-white rounded-lg border border-slate-200',
                    'flex items-center justify-center',
                    'opacity-60 hover:opacity-100 transition-opacity',
                    'shadow-sm'
                  )}
                >
                  <span className="text-slate-500 text-xs text-center px-2">{partner.name}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
