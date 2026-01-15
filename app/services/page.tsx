'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ServicesBento } from '@/components/sections/ServicesBento'
import { fadeIn, fadeInUp, staggerGrid, staggerItem, slideInLeft, slideInRight, timelineAnimation } from '@/lib/animations'
import { SERVICES } from '@/lib/constants'
import { ArrowRight, CheckCircle2, Search, ShoppingCart, Wrench, Package, Clock, Shield, Globe } from 'lucide-react'
import { GlassCard, CardImage } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

const processSteps = [
  {
    step: '01',
    title: 'Request',
    description: 'Submit your parts request or repair inquiry through our portal or contact our team directly.',
    icon: Search,
  },
  {
    step: '02',
    title: 'Match & Quote',
    description: 'Our team searches our global network and provides competitive quotes within hours.',
    icon: ShoppingCart,
  },
  {
    step: '03',
    title: 'Process',
    description: 'We handle all logistics, certifications, and quality checks before shipment.',
    icon: Package,
  },
  {
    step: '04',
    title: 'Deliver',
    description: 'Your parts arrive on time, certified and ready for installation.',
    icon: CheckCircle2,
  },
]

const benefits = [
  {
    title: '24/7 Availability',
    description: 'Round-the-clock support for urgent AOG situations',
    icon: Clock,
  },
  {
    title: 'Certified Quality',
    description: 'All parts meet FAA/EASA standards with full traceability',
    icon: Shield,
  },
  {
    title: 'Global Network',
    description: 'Access to suppliers and partners worldwide',
    icon: Globe,
  },
]

export default function ServicesPage() {
  return (
    <motion.main
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="bg-white text-navy overflow-x-hidden"
    >
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] w-full overflow-hidden flex items-center justify-center dark-theme-section pt-32">
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
              Our Services
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              <span className="text-white">COMPREHENSIVE</span>
              <br />
              <span className="text-electric-blue-400">AVIATION SOLUTIONS</span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-300 max-w-2xl mx-auto"
            >
              From parts sourcing to expert repairs, we provide end-to-end support for your aviation operations.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <ServicesBento />

      {/* Process Section */}
      <section className="relative py-28 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-20"
          >
            <p className="text-electric-blue uppercase tracking-[0.3em] text-sm font-medium mb-4">
              How We Work
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              Our <span className="text-electric-blue">Process</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A streamlined approach designed to minimize downtime and maximize efficiency
            </p>
          </motion.div>

          <motion.div
            variants={timelineAnimation}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {processSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                  className="relative"
                >
                  <div className="h-full p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-electric-blue/50 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 rounded-xl bg-electric-blue/10 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-electric-blue" />
                      </div>
                      <span className="text-4xl font-extrabold text-slate-200">{step.step}</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-navy mb-3">{step.title}</h3>
                    <p className="text-slate-600">{step.description}</p>
                  </div>
                  {index < processSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-electric-blue to-transparent" />
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
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
              Why Choose Us
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              <span className="text-electric-blue-400">THE GENTHRUST</span>
              <br />
              <span className="text-white">ADVANTAGE</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <motion.div
                  key={benefit.title}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard className="h-full p-8 text-center">
                    <div className="w-16 h-16 rounded-xl bg-electric-blue/25 flex items-center justify-center mb-6 mx-auto">
                      <Icon className="w-8 h-8 text-electric-blue-400" />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">{benefit.title}</h3>
                    <p className="text-slate-600">{benefit.description}</p>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

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
              Ready to Get <span className="text-electric-blue">Started?</span>
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Contact our team to discuss your specific requirements and discover how we can support your operations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg">Contact Us</Button>
              </Link>
              <Link href="/inventory">
                <Button variant="outline" size="lg">Browse Inventory</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </motion.main>
  )
}
