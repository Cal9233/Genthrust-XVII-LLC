'use client'

import { motion } from 'framer-motion'
import { Target, Eye, Heart, MapPin, Clock } from 'lucide-react'
import { COMPANY_INFO, MISSION_VISION_VALUES } from '@/lib/constants'

export function CredentialsSection() {
  return (
    <section id="credentials" className="relative py-20 bg-navy-800">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header - What we're about */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            What we're about
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto mb-6">
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
          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            className="bg-navy-700/50 border border-navy-600 rounded-lg p-4 md:p-6 hover:border-navy-500 hover:bg-navy-700/70 transition-all text-center"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3">
              {MISSION_VISION_VALUES.mission.title}
            </h3>
            <p className="text-slate-300 text-sm">
              {MISSION_VISION_VALUES.mission.text}
            </p>
          </motion.div>

          {/* Vision */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-navy-700/50 border border-navy-600 rounded-lg p-4 md:p-6 hover:border-navy-500 hover:bg-navy-700/70 transition-all text-center"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Eye className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3">
              {MISSION_VISION_VALUES.vision.title}
            </h3>
            <p className="text-slate-300 text-sm">
              {MISSION_VISION_VALUES.vision.text}
            </p>
          </motion.div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-navy-700/50 border border-navy-600 rounded-lg p-4 md:p-6 hover:border-navy-500 hover:bg-navy-700/70 transition-all text-center"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-burgundy-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Heart className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3">
              {MISSION_VISION_VALUES.values.title}
            </h3>
            <p className="text-slate-300 text-sm">
              {MISSION_VISION_VALUES.values.text}
            </p>
          </motion.div>
        </div>

      </div>
    </section>
  )
}
