'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Plane } from 'lucide-react'

// Loading spinner component for dynamic imports
function LoadingSpinner() {
  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800/50 flex items-center justify-center">
      <motion.div
        className="w-16 h-16 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// Dynamically import the R3F component with SSR disabled
const ParticleVertexAircraft = dynamic(
  () => import('@/components/ParticleVertexAircraft'),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

export default function AviationShowcase() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-6">
            <Plane className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm tracking-wider">GENTHRUST LABS</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Digital <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Twin</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Engineering precision visualized — every vertex rendered as living data.
          </p>
        </div>

        {/* Visualization */}
        <div className="max-w-5xl mx-auto">
          <ParticleVertexAircraft />
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-16">
          Built with React Three Fiber + Framer Motion + Tailwind CSS
        </p>
      </div>
    </div>
  )
}
