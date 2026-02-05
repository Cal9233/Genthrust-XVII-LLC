'use client'

import { motion } from 'framer-motion'
import { Search, Wrench, ShoppingCart, Plane } from 'lucide-react'
import { SERVICES } from '@/lib/constants'
import { fadeInUp, staggerGrid, staggerItem, iconBounce } from '@/lib/animations'

const iconMap = {
  Search,
  Wrench,
  ShoppingCart,
  Plane,
}

export function ServicesBento() {
  return (
    <section className="relative py-28 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
            What We Offer
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
            Our <span className="text-electric-blue">Services</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Comprehensive aviation solutions tailored to your operational needs
          </p>
        </motion.div>

        <motion.div
          variants={staggerGrid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {SERVICES.map((service) => {
            const Icon = iconMap[service.icon as keyof typeof iconMap]
            return (
              <motion.div
                key={service.title}
                variants={staggerItem}
                whileHover={{ y: -4 }}
                className="group relative p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-electric-blue/50 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <motion.div
                  variants={iconBounce}
                  initial="rest"
                  whileHover="hover"
                  className="relative w-16 h-16 rounded-xl bg-electric-blue/10 flex items-center justify-center mb-6 group-hover:bg-electric-blue/20 transition-all duration-300"
                >
                  <Icon className="w-8 h-8 text-electric-blue" />
                </motion.div>
                <h3 className="text-xl font-extrabold text-navy mb-3 group-hover:text-electric-blue transition-colors">
                  {service.title}
                </h3>
                <p className="text-slate-600">{service.description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
