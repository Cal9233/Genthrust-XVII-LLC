'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Loader2, ChevronDown } from 'lucide-react'
import { CONDITION_OPTIONS, AIRCRAFT_OPTIONS } from '@/lib/constants'

interface SearchResult {
  product_name: string
  mfr_part_no: string
  product_category: string
}

export function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [condition, setCondition] = useState('all')
  const [aircraft, setAircraft] = useState('all')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError('')

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.results ?? data)
    } catch {
      setError('Search unavailable. Please try again.')
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  const popularTerms = ['CFM56', 'APU Starter', 'Landing Gear', 'Avionics', 'Hydraulic Pump']

  return (
    <section id="search" className="relative py-24 md:py-32 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Search Our Inventory
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto text-lg">
            Access over 500,000 certified components. Enter a part number, NSN, or description.
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
          {/* Main search input — prominent */}
          <div className="relative mb-6">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Part Number, NSN, or Description..."
              className="w-full pl-14 pr-4 py-5 text-lg bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/10 transition-all shadow-sm"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Condition select */}
            <div className="flex-1">
              <label htmlFor="condition" className="sr-only">Condition</label>
              <div className="relative">
                <select
                  id="condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/10 transition-all appearance-none cursor-pointer pr-10"
                >
                  {CONDITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Aircraft select */}
            <div className="flex-1">
              <label htmlFor="aircraft" className="sr-only">Aircraft Type</label>
              <div className="relative">
                <select
                  id="aircraft"
                  value={aircraft}
                  onChange={(e) => setAircraft(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/10 transition-all appearance-none cursor-pointer pr-10"
                >
                  {AIRCRAFT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Search button */}
            <div className="md:self-end">
              <button
                type="submit"
                disabled={isSearching}
                className="w-full md:w-auto px-8 py-3 bg-burgundy-600 hover:bg-burgundy-700 disabled:bg-burgundy-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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

          {/* Search chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-slate-400 text-sm py-1.5">Popular:</span>
            {popularTerms.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchQuery(term)}
                className="text-sm text-slate-600 bg-slate-100 hover:bg-burgundy-50 hover:text-burgundy-600 px-3 py-1.5 rounded-full transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </motion.form>

        {/* Search results */}
        {error && (
          <div className="max-w-4xl mx-auto mt-6 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {results !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mt-8"
          >
            <p className="text-sm text-slate-500 mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            {results.length > 0 ? (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {results.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-mono text-sm text-navy-600 mr-3">{r.mfr_part_no}</span>
                      <span className="text-slate-900">{r.product_name}</span>
                    </div>
                    {r.product_category && (
                      <span className="text-xs text-slate-400 hidden sm:inline">{r.product_category}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">
                No components found. Try a different search term or{' '}
                <a href="#contact" className="text-burgundy-600 hover:underline">contact us</a> for assistance.
              </p>
            )}
          </motion.div>
        )}
      </div>
    </section>
  )
}
