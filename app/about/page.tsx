'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { StatsBar } from '@/components/sections/StatsBar'
import { fadeIn, fadeInUp, staggerGrid, staggerItem, slideInLeft, slideInRight, iconBounce } from '@/lib/animations'
import { ADVANTAGES, STATS } from '@/lib/constants'
import { Shield, Clock, Globe, Award, Building2, Users, Award as AwardIcon, FileCheck } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const iconMap = {
  Shield,
  Clock,
  Globe,
  Award,
}

const certifications = [
  {
    title: 'FAA Certified',
    description: 'Federal Aviation Administration certification for all repair operations',
    icon: FileCheck,
  },
  {
    title: 'EASA Approved',
    description: 'European Aviation Safety Agency approval for international operations',
    icon: AwardIcon,
  },
  {
    title: 'ISO 9001:2015',
    description: 'International quality management system certification',
    icon: AwardIcon,
  },
]

export default function AboutPage() {
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
              About GENTHRUST
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              <span className="text-white">POWERING GLOBAL</span>
              <br />
              <span className="text-electric-blue-400">AVIATION</span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-300 max-w-2xl mx-auto"
            >
              Your trusted partner for buying, selling, and repairing certified aircraft components worldwide.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Story Section */}
      <section className="relative py-28 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={slideInLeft}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-6">
                Our <span className="text-electric-blue">Story</span>
              </h2>
              <p className="text-lg text-slate-600 mb-4">
                Founded with a vision to revolutionize the aviation parts supply chain, GENTHRUST has grown from a
                specialized broker to a global leader in aircraft component solutions.
              </p>
              <p className="text-lg text-slate-600 mb-4">
                We understand that every minute of aircraft downtime costs. That's why we've built a network spanning
                continents, connecting operators with certified parts and expert repair services 24/7.
              </p>
              <p className="text-lg text-slate-600">
                Today, we serve airlines, MRO facilities, and operators worldwide, ensuring they have access to the
                parts they need, when they need them most.
              </p>
            </motion.div>

            <motion.div
              variants={slideInRight}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="relative"
            >
              <div className="relative h-[400px] bg-gradient-to-br from-electric-blue/10 to-slate-100 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Building2 className="w-32 h-32 text-electric-blue/30" />
                </div>
                <div className="absolute bottom-4 right-4 text-xs text-slate-400 bg-white/80 px-3 py-1 rounded">
                  [Company Image Placeholder]
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
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
              Our Values
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              What <span className="text-electric-blue">Drives Us</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {ADVANTAGES.map((advantage) => {
              const Icon = iconMap[advantage.icon as keyof typeof iconMap]
              return (
                <motion.div
                  key={advantage.title}
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
                  <h3 className="text-lg font-extrabold text-navy mb-3 group-hover:text-electric-blue transition-colors">
                    {advantage.title}
                  </h3>
                  <p className="text-slate-600">{advantage.description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Certifications Section */}
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
              Certifications
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              <span className="text-electric-blue-400">CERTIFIED</span>
              <br />
              <span className="text-white">COMPLIANCE</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {certifications.map((cert, index) => {
              const Icon = cert.icon
              return (
                <motion.div
                  key={cert.title}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard className="h-full p-8 text-center">
                    <motion.div
                      variants={iconBounce}
                      initial="rest"
                      whileHover="hover"
                      className="w-16 h-16 rounded-xl bg-electric-blue/25 flex items-center justify-center mb-6 mx-auto"
                    >
                      <Icon className="w-8 h-8 text-electric-blue-400" />
                    </motion.div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">{cert.title}</h3>
                    <p className="text-slate-600">{cert.description}</p>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <StatsBar />

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
              Ready to Work <span className="text-electric-blue">Together?</span>
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Experience the GENTHRUST difference. Let's discuss how we can support your aviation needs.
            </p>
            <Link href="/contact">
              <Button size="lg">Get In Touch</Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </motion.main>
  )
}
