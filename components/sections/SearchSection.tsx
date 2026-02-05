'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'
import { CONDITION_OPTIONS, AIRCRAFT_OPTIONS } from '@/lib/constants'

export function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [condition, setCondition] = useState('all')
  const [aircraft, setAircraft] = useState('all')
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    // Simulate search - in production this would call an API
    setTimeout(() => setIsSearching(false), 1500)
  }

  return (
    <section id="search" className="relative py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Search Our Inventory
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Access over 500,000 certified components. Enter a part number, NSN, or description to get started.
          </p>
        </motion.div>

        {/* Search form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleSearch}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-navy-50 border border-navy-100 rounded-lg p-4 md:p-6 shadow-sm">
            {/* Main search input */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Part Number, NSN, or Description..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-navy-200 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:border-burgundy-500 focus:ring-2 focus:ring-burgundy-500/20 transition-colors"
              />
            </div>

            {/* Filters row */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Condition select */}
              <div className="flex-1">
                <label htmlFor="condition" className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Condition
                </label>
                <select
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-navy-200 rounded text-slate-900 focus:outline-none focus:border-burgundy-500 focus:ring-2 focus:ring-burgundy-500/20 transition-colors appearance-none cursor-pointer"
                >
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aircraft select */}
              <div className="flex-1">
                <label htmlFor="aircraft" className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Aircraft Type
                </label>
                <select
                  id="aircraft"
                  value={aircraft}
                  onChange={(e) => setAircraft(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-navy-200 rounded text-slate-900 focus:outline-none focus:border-burgundy-500 focus:ring-2 focus:ring-burgundy-500/20 transition-colors appearance-none cursor-pointer"
                >
                  {AIRCRAFT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search button */}
              <div className="md:self-end">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full md:w-auto px-8 py-3 bg-burgundy-600 hover:bg-burgundy-700 disabled:bg-burgundy-400 text-white font-semibold rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <span className="text-slate-500 text-sm">Popular:</span>
            {['CFM56', 'APU Starter', 'Landing Gear', 'Avionics'].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchQuery(term)}
                className="text-sm text-burgundy-600 hover:text-burgundy-700 py-1.5 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </motion.form>
      </div>
    </section>
  )
}
