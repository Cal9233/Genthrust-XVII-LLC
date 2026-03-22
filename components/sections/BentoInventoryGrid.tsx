'use client'

import { motion } from 'framer-motion'
import { Cog, Radio, Plane } from 'lucide-react'
import { BorderBeam } from '@/components/ui/BorderBeam'
import { DataPing } from '@/components/ui/DataPing'
import { cn } from '@/lib/utils'

interface InventoryCategory {
  id: string
  title: string
  icon: typeof Cog
  stats: { count: string; label: string }
  description: string
}

const INVENTORY_CATEGORIES: InventoryCategory[] = [
  {
    id: 'engine',
    title: 'Engine Parts',
    icon: Cog,
    stats: { count: '2,500+', label: 'components' },
    description: 'CFM56, V2500, PW4000 series',
  },
  {
    id: 'avionics',
    title: 'Avionics',
    icon: Radio,
    stats: { count: '1,200+', label: 'units' },
    description: 'FMC, TCAS, Weather Radar',
  },
  {
    id: 'airframe',
    title: 'Airframe',
    icon: Plane,
    stats: { count: '3,000+', label: 'parts' },
    description: 'Landing gear, actuators, structures',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
}

interface BentoInventoryGridProps {
  className?: string
}

export function BentoInventoryGrid({ className }: BentoInventoryGridProps) {
  return (
    <section className={cn('py-16 px-4 bg-space', className)}>
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-silver mb-3">
            Inventory <span className="text-horizon-blue">Categories</span>
          </h2>
          <p className="text-silver/60 max-w-lg mx-auto">
            Comprehensive aviation component sourcing across all major categories
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {INVENTORY_CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <motion.div key={category.id} variants={itemVariants}>
                <BorderBeam duration={6} borderRadius="1.5rem">
                  <div className="glass-card p-6 h-full min-h-[200px] relative group cursor-pointer transition-all duration-300 hover:bg-white/[0.05]">
                    {/* Data-Ping overlay */}
                    <DataPing className="absolute top-4 right-4" />

                    {/* Icon */}
                    <div className="mb-4">
                      <div className="w-12 h-12 rounded-xl bg-horizon-blue/10 flex items-center justify-center group-hover:bg-horizon-blue/20 transition-colors">
                        <Icon className="w-6 h-6 text-horizon-blue" />
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-silver mb-2 group-hover:text-white transition-colors">
                      {category.title}
                    </h3>

                    {/* Stats */}
                    <p className="font-mono text-sm text-horizon-blue mb-2">
                      {category.stats.count}{' '}
                      <span className="text-silver/40">{category.stats.label}</span>
                    </p>

                    {/* Description */}
                    <p className="text-sm text-silver/50 group-hover:text-silver/70 transition-colors">
                      {category.description}
                    </p>

                    {/* Hover indicator */}
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-horizon-blue font-mono">EXPLORE →</span>
                    </div>
                  </div>
                </BorderBeam>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
