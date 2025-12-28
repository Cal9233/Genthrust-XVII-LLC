'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Plane, Wrench, Package } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/animations'
import { GlassCard } from '@/components/ui/GlassCard'
import { SERVICES } from '@/lib/constants'

const iconMap = {
  'parts-brokerage': Plane,
  'component-mro': Wrench,
  'airline-supply': Package,
}

export function ServicesBento() {
  return (
    <section id="services" className="relative py-24 bg-white">
      {/* Subtle background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-electric-blue/5 blur-3xl rounded-full" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
            Our Services
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-navy">
            The Core of Aviation Excellence
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {SERVICES.map((service) => {
            const Icon = iconMap[service.id as keyof typeof iconMap]

            return (
              <motion.div
                key={service.id}
                variants={staggerItem}
                className={service.featured ? 'md:col-span-2 lg:col-span-2 lg:row-span-2' : ''}
              >
                <GlassCard
                  featured={service.featured}
                  className={service.featured ? 'h-full min-h-[400px]' : 'h-full min-h-[280px]'}
                >
                  <div className="flex flex-col h-full p-6 md:p-8">
                    {/* Image placeholder */}
                    <div
                      className={`relative w-full bg-slate-100 rounded-xl overflow-hidden mb-6 ${service.featured ? 'h-48 md:h-64' : 'h-32'}`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon
                          className={`text-electric-blue/30 ${service.featured ? 'w-24 h-24' : 'w-16 h-16'}`}
                        />
                      </div>
                      {/* Placeholder text */}
                      <div className="absolute bottom-2 right-2 text-xs text-slate-400">
                        [Image Placeholder]
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <p className="text-electric-blue text-xs uppercase tracking-widest mb-2">
                        {service.subtitle}
                      </p>
                      <h3
                        className={`font-bold text-navy mb-3 ${service.featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}
                      >
                        {service.title}
                      </h3>
                      <p
                        className={`text-slate-600 leading-relaxed ${service.featured ? 'text-base' : 'text-sm'}`}
                      >
                        {service.description}
                      </p>
                    </div>

                    {/* CTA */}
                    <a
                      href={service.href}
                      className="inline-flex items-center gap-2 mt-6 text-electric-blue hover:text-electric-blue-700 font-medium text-sm group/link"
                    >
                      {service.cta}
                      <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
