'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Plane, Wrench, Package } from 'lucide-react'
import { staggerGrid, fadeInUp, slideInLeft, slideInRight } from '@/lib/animations'
import { GlassCard, CardImage } from '@/components/ui/GlassCard'
import { SERVICES } from '@/lib/constants'

const iconMap = {
  'parts-brokerage': Plane,
  'component-mro': Wrench,
  'airline-supply': Package,
}

export function ServicesBento() {
  return (
    <section id="services" className="relative py-28 bg-gradient-to-b from-white to-slate-50">
      {/* Enhanced background accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-b from-electric-blue/10 via-electric-blue/5 to-transparent blur-3xl rounded-full" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-electric-blue/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-20"
        >
          <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
            Our Services
          </p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4">
            <span className="text-electric-blue">THE CORE OF</span>
            <br />
            <span className="text-navy">AVIATION EXCELLENCE</span>
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {SERVICES.map((service, index) => {
            const Icon = iconMap[service.id as keyof typeof iconMap]
            const isLeft = index % 3 === 0
            const isRight = index % 3 === 2
            const slideVariant = isLeft ? slideInLeft : isRight ? slideInRight : fadeInUp

            return (
              <motion.div
                key={service.id}
                variants={slideVariant}
                className={service.featured ? 'md:col-span-2 lg:col-span-2 lg:row-span-2' : ''}
              >
                <GlassCard
                  featured={service.featured}
                  className={service.featured ? 'h-full min-h-[400px]' : 'h-full min-h-[280px]'}
                >
                  <div className="flex flex-col h-full p-6 md:p-8">
                    {/* Image placeholder with zoom effect */}
                    <CardImage
                      className={`relative w-full bg-gradient-to-br from-electric-blue/10 via-electric-blue/5 to-slate-100 rounded-xl overflow-hidden mb-6 ${service.featured ? 'h-48 md:h-64' : 'h-32'}`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon
                          className={`text-electric-blue/40 ${service.featured ? 'w-24 h-24' : 'w-16 h-16'}`}
                        />
                      </div>
                      {/* Placeholder text */}
                      <div className="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
                        [Image Placeholder]
                      </div>
                    </CardImage>

                    {/* Content */}
                    <div className="flex-1">
                      <p className="text-electric-blue text-xs uppercase tracking-widest mb-3 font-semibold">
                        {service.subtitle}
                      </p>
                      <h3
                        className={`font-extrabold text-navy mb-4 ${service.featured ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-xl md:text-2xl'}`}
                      >
                        {service.title}
                      </h3>
                      <p
                        className={`text-slate-600 leading-relaxed ${service.featured ? 'text-base md:text-lg' : 'text-sm md:text-base'}`}
                      >
                        {service.description}
                      </p>
                    </div>

                    {/* CTA */}
                    <a
                      href={service.href}
                      className="inline-flex items-center gap-2 mt-8 text-electric-blue hover:text-electric-blue-700 font-semibold text-sm group/link transition-colors"
                    >
                      {service.cta}
                      <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform duration-300" />
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
