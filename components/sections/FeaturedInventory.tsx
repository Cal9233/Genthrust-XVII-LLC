'use client'

import { motion } from 'framer-motion'
import { Package, ArrowRight, Phone } from 'lucide-react'
import { FEATURED_PARTS } from '@/lib/constants'

function StatusBadge({ status }: { status: string }) {
  if (status === 'available') {
    return (
      <span className="badge-available">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        In Stock
      </span>
    )
  }
  if (status === 'limited') {
    return (
      <span className="badge-limited">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
        Limited
      </span>
    )
  }
  return (
    <span className="badge-aog">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
      AOG Priority
    </span>
  )
}

export function FeaturedInventory() {
  return (
    <section id="inventory" className="relative py-24 md:py-32 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Featured Components
            </h2>
            <p className="text-slate-600 text-lg">
              Recently added and high-demand parts from our verified inventory.
            </p>
          </div>
          <a
            href="#search"
            className="inline-flex items-center gap-2 text-burgundy-600 hover:text-burgundy-700 transition-colors font-medium"
          >
            View All Inventory
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Parts grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {FEATURED_PARTS.map((part, index) => (
            <motion.article
              key={part.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 hover:shadow-card-hover transition-all group"
            >
              {/* Image placeholder */}
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 relative flex items-center justify-center">
                <Package className="w-12 h-12 text-slate-300 group-hover:text-slate-400 transition-colors" />
                {/* Status badge overlay */}
                <div className="absolute top-3 right-3">
                  <StatusBadge status={part.status} />
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Part number — prominent */}
                <p className="font-mono text-base font-semibold text-navy-600 mb-1">
                  {part.partNumber}
                </p>

                {/* Description */}
                <h3 className="text-slate-900 font-medium mb-2 group-hover:text-navy-600 transition-colors">
                  {part.description}
                </h3>

                {/* Meta info */}
                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <span>{part.condition}</span>
                  <span>{part.aircraft}</span>
                </div>

                {/* CTA */}
                <button className="w-full py-2.5 sm:py-3 border border-slate-300 hover:border-burgundy-500 hover:bg-burgundy-50 hover:text-burgundy-600 text-slate-600 text-sm font-medium rounded transition-colors">
                  Request Quote
                </button>
              </div>
            </motion.article>
          ))}
        </div>

        {/* CTA banner with AOG phone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 bg-burgundy-50 border border-burgundy-100 rounded-lg p-4 sm:p-6 md:p-8 text-center"
        >
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Can't find what you need?
          </h3>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Our sourcing team can locate hard-to-find components from our global network of 500+ certified suppliers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-burgundy-600 hover:bg-burgundy-700 text-white font-semibold rounded transition-colors"
            >
              Submit Sourcing Request
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="tel:+13054500191"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-burgundy-300 hover:bg-burgundy-100 text-burgundy-700 font-semibold rounded transition-colors"
            >
              <Phone className="w-4 h-4" />
              AOG? Call (305) 450-0191
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
