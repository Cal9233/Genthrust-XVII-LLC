'use client'

import { motion } from 'framer-motion'
import { Target, Eye, Heart, MapPin, Clock, ShieldCheck } from 'lucide-react'
import { COMPANY_INFO, MISSION_VISION_VALUES } from '@/lib/constants'

export function CredentialsSection() {
  return (
    <section id="credentials" className="relative py-24 md:py-32 bg-navy-800">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Customers Choose Us
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto mb-8 text-lg">
            {COMPANY_INFO.tagline}. {COMPANY_INFO.description}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-burgundy-400" />
              <span className="text-sm font-medium">{COMPANY_INFO.experience} years of experience</span>
            </div>
            <div className="w-px h-4 bg-navy-600 hidden sm:block" />
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-burgundy-400" />
              <span className="text-sm font-medium">{COMPANY_INFO.location}</span>
            </div>
          </div>
        </motion.div>

        {/* Mission / Vision / Values grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {/* Mission — gradient top border */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            className="bg-navy-700/50 border border-navy-600 rounded-lg overflow-hidden hover:border-navy-500 hover:bg-navy-700/70 transition-all text-center"
          >
            <div className="h-1 bg-gradient-to-r from-burgundy-600 to-burgundy-400" />
            <div className="p-4 md:p-6">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Target className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                {MISSION_VISION_VALUES.mission.title}
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                {MISSION_VISION_VALUES.mission.text}
              </p>
            </div>
          </motion.div>

          {/* Vision — slightly larger (featured) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-navy-700/60 border-2 border-navy-500 rounded-lg p-5 md:p-8 hover:border-navy-400 hover:bg-navy-700/80 transition-all text-center md:-mt-2 md:mb-[-0.5rem]"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Eye className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white mb-3">
              {MISSION_VISION_VALUES.vision.title}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {MISSION_VISION_VALUES.vision.text}
            </p>
          </motion.div>

          {/* Values — lists actual values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-navy-700/50 border border-navy-600 rounded-lg p-4 md:p-6 hover:border-navy-500 hover:bg-navy-700/70 transition-all text-center"
          >
            <div className="w-12 h-12 md:w-14 md:h-14 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Heart className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">
              {MISSION_VISION_VALUES.values.title}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              {MISSION_VISION_VALUES.values.text}
            </p>
            <ul className="text-slate-400 text-xs space-y-1">
              <li>Accountability</li>
              <li>Fairness</li>
              <li>Integrity</li>
            </ul>
          </motion.div>
        </div>

        {/* Certifications row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-8 pt-8 border-t border-navy-700"
        >
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-5 h-5 text-burgundy-400" />
            <span className="text-sm font-medium">ASA-100 Accredited</span>
          </div>
          <div className="w-px h-4 bg-navy-600 hidden sm:block" />
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-5 h-5 text-burgundy-400" />
            <span className="text-sm font-medium">ISO 9001 Compliant</span>
          </div>
          <div className="w-px h-4 bg-navy-600 hidden sm:block" />
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-5 h-5 text-burgundy-400" />
            <span className="text-sm font-medium">FAA AC 00-56B</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
