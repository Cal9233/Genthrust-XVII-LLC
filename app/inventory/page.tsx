'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { fadeIn, fadeInUp, staggerGrid, staggerItem, slideInLeft, slideInRight } from '@/lib/animations'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'
import { GlassCard, CardImage } from '@/components/ui/GlassCard'
import { InventoryTable } from '@/components/ui/InventoryTable'
import { InventoryItem } from '@/types/inventory'
import { Plane, Package, Wrench, Settings, Search, Filter } from 'lucide-react'
import Link from 'next/link'

const categories = [
  {
    title: 'Engine Components',
    description: 'Turbine engines, propellers, and related components',
    icon: Settings,
    count: '50K+',
  },
  {
    title: 'Avionics',
    description: 'Navigation systems, communication equipment, and displays',
    icon: Settings,
    count: '30K+',
  },
  {
    title: 'Landing Gear',
    description: 'Wheels, brakes, struts, and hydraulic systems',
    icon: Settings,
    count: '25K+',
  },
  {
    title: 'Interior & Cabin',
    description: 'Seats, galleys, lavatories, and cabin fixtures',
    icon: Package,
    count: '40K+',
  },
  {
    title: 'Aircraft Structures',
    description: 'Fuselage, wings, and structural components',
    icon: Plane,
    count: '35K+',
  },
  {
    title: 'Maintenance Tools',
    description: 'Specialized tools and equipment for aircraft maintenance',
    icon: Wrench,
    count: '20K+',
  },
]

const featuredParts = [
  {
    partNumber: 'PN-12345',
    description: 'Turbine Engine Blade',
    aircraft: 'Boeing 737',
    condition: 'Serviceable',
    location: 'Miami, FL',
  },
  {
    partNumber: 'PN-67890',
    description: 'Avionics Display Unit',
    aircraft: 'Airbus A320',
    condition: 'Overhauled',
    location: 'Los Angeles, CA',
  },
  {
    partNumber: 'PN-11111',
    description: 'Landing Gear Assembly',
    aircraft: 'Boeing 777',
    condition: 'New',
    location: 'Dallas, TX',
  },
]

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Failed to search inventory')
      }
      const data = await response.json()
      setSearchResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery)
    }, 300) // 300ms debounce delay

    return () => clearTimeout(timeoutId)
  }, [searchQuery, performSearch])

  const hasSearched = searchQuery.trim().length > 0

  return (
    <motion.main
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="bg-white text-navy overflow-x-hidden"
    >
      <Navbar />

      {/* Hero Section with Search */}
      <section className="relative min-h-[70vh] w-full overflow-hidden flex items-center justify-center dark-theme-section pt-32">
        <div className="absolute inset-0 bg-gradient-hero-dark" />
        <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/10 via-transparent to-electric-blue/5" />
        
        <motion.div
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-electric-blue/20 rounded-full blur-3xl"
        />

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            variants={staggerItem}
            initial="hidden"
            animate="visible"
            className="text-center max-w-4xl mx-auto"
          >
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-6"
            >
              Parts Inventory
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              <span className="text-white">500K+ PARTS</span>
              <br />
              <span className="text-electric-blue-400">AT YOUR FINGERTIPS</span>
            </motion.h1>
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="mt-8"
            >
              <SearchInput
                dark
                placeholder="Search by part number or description..."
                className="w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex flex-wrap justify-center gap-4 mt-6">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" size="sm">
                  Browse Categories
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="relative py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-20"
          >
            <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
              Browse by Category
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              Find What You <span className="text-electric-blue">Need</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Explore our extensive inventory organized by component type
            </p>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {categories.map((category, index) => {
              const Icon = category.icon
              const isLeft = index % 3 === 0
              const isRight = index % 3 === 2
              const slideVariant = isLeft ? slideInLeft : isRight ? slideInRight : fadeInUp
              
              return (
                <motion.div
                  key={category.title}
                  variants={slideVariant}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard className="h-full p-8 cursor-pointer">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 rounded-xl bg-electric-blue/25 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-electric-blue-400" />
                      </div>
                      <span className="text-2xl font-extrabold text-electric-blue-400">{category.count}</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-white mb-3">{category.title}</h3>
                    <p className="text-slate-300 mb-4">{category.description}</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Browse Category
                    </Button>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Search Results Section */}
      {hasSearched && (
        <section className="relative py-28 bg-gradient-to-b from-dark-charcoal-300 via-dark-charcoal-200 to-dark-charcoal-300 overflow-hidden">
          <div className="absolute top-1/2 left-0 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-crimson/10 rounded-full blur-3xl -translate-y-1/2" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
                <span className="text-electric-blue-400">SEARCH RESULTS</span>
              </h2>
              {searchResults.length > 0 && (
                <p className="text-slate-300 text-lg">
                  Found {searchResults.length} {searchResults.length === 1 ? 'item' : 'items'}
                </p>
              )}
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 bg-red-950/30 border border-red-500/50 rounded-lg text-red-400 text-center"
              >
                {error}
              </motion.div>
            )}

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <InventoryTable items={searchResults} isLoading={isLoading} />
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Parts Section - Only show when not searching */}
      {!hasSearched && (
        <section className="relative py-28 bg-gradient-to-b from-dark-charcoal-300 via-dark-charcoal-200 to-dark-charcoal-300 overflow-hidden">
          <div className="absolute top-1/2 left-0 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-crimson/10 rounded-full blur-3xl -translate-y-1/2" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-20"
            >
              <p className="text-electric-blue-300 uppercase tracking-[0.3em] text-sm font-medium mb-4">
                Featured Parts
              </p>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
                <span className="text-electric-blue-400">AVAILABLE NOW</span>
              </h2>
            </motion.div>

            <motion.div
              variants={staggerGrid}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto"
            >
              {featuredParts.map((part) => (
                <motion.div
                  key={part.partNumber}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard className="h-full p-6">
                    <div className="mb-4">
                      <span className="text-electric-blue-400 text-sm font-semibold">{part.partNumber}</span>
                      <h3 className="text-xl font-extrabold text-white mt-2 mb-2">{part.description}</h3>
                      <p className="text-slate-400 text-sm mb-4">{part.aircraft}</p>
                    </div>
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                      <span className="text-sm text-slate-300">Condition:</span>
                      <span className="text-sm font-semibold text-green-400">{part.condition}</span>
                    </div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm text-slate-300">Location:</span>
                      <span className="text-sm font-semibold text-white">{part.location}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      Request Quote
                    </Button>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="relative py-28 bg-gradient-to-b from-white to-electric-blue/5">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-6">
              Can't Find What You're <span className="text-electric-blue">Looking For?</span>
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Our team can search our global network to locate even the hardest-to-find parts. Contact us for a custom search.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg">Request Custom Search</Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" size="lg">Learn More</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </motion.main>
  )
}
