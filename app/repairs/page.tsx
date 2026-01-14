'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Modal } from '@/components/ui/Modal'
import { fadeIn, fadeInUp, staggerGrid, staggerItem, slideInLeft, slideInRight, timelineAnimation, iconBounce } from '@/lib/animations'
import { Wrench, Clock, Shield, CheckCircle2, FileCheck, Award as AwardIcon, Send } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const repairServices = [
  {
    title: 'Component Overhaul',
    description: 'Complete restoration and testing of aircraft components to serviceable condition',
    icon: Wrench,
  },
  {
    title: 'Rapid Repair',
    description: 'Fast-turnaround repairs for urgent AOG situations with 24/7 support',
    icon: Clock,
  },
  {
    title: 'Testing & Certification',
    description: 'Comprehensive testing and certification services meeting all regulatory standards',
    icon: FileCheck,
  },
  {
    title: 'Inspection Services',
    description: 'Detailed component inspections and condition assessments',
    icon: Shield,
  },
]

const processSteps = [
  {
    step: '01',
    title: 'Submit Request',
    description: 'Send us your component details and repair requirements',
  },
  {
    step: '02',
    title: 'Evaluation',
    description: 'Our experts assess the component and provide a detailed quote',
  },
  {
    step: '03',
    title: 'Repair Process',
    description: 'Certified technicians perform the repair following strict protocols',
  },
  {
    step: '04',
    title: 'Quality Assurance',
    description: 'Rigorous testing and certification before return shipment',
  },
]

const certifications = [
  {
    title: 'FAA Repair Station',
    description: 'Certified repair station #12345',
    icon: FileCheck,
  },
  {
    title: 'EASA Part 145',
    description: 'Approved organization for component maintenance',
    icon: AwardIcon,
  },
  {
    title: 'ISO 9001:2015',
    description: 'Quality management system certified',
    icon: Shield,
  },
]

export default function RepairsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    partNumber: '',
    description: '',
    aircraft: '',
    contactName: '',
    email: '',
    phone: '',
    urgency: 'standard',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log('Form submitted:', formData)
    setIsModalOpen(false)
  }

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
              Repair Services
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              <span className="text-white">EXPERT REPAIRS</span>
              <br />
              <span className="text-electric-blue-400">CERTIFIED QUALITY</span>
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-300 max-w-2xl mx-auto mb-8"
            >
              FAA/EASA certified repair services with rapid turnaround times to keep your fleet flying.
            </motion.p>
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
            >
              <Button size="lg" onClick={() => setIsModalOpen(true)}>
                Request Repair
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services Overview */}
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
              Our Services
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              Comprehensive <span className="text-electric-blue">Repair Solutions</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {repairServices.map((service) => {
              const Icon = service.icon
              return (
                <motion.div
                  key={service.title}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard className="h-full p-8">
                    <motion.div
                      variants={iconBounce}
                      initial="rest"
                      whileHover="hover"
                      className="w-16 h-16 rounded-xl bg-electric-blue/25 flex items-center justify-center mb-6"
                    >
                      <Icon className="w-8 h-8 text-electric-blue-400" />
                    </motion.div>
                    <h3 className="text-xl font-extrabold text-white mb-3">{service.title}</h3>
                    <p className="text-slate-300">{service.description}</p>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Process Section */}
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
              Our Process
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              <span className="text-electric-blue-400">FROM REQUEST</span>
              <br />
              <span className="text-white">TO COMPLETION</span>
            </h2>
          </motion.div>

          <motion.div
            variants={timelineAnimation}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {processSteps.map((step, index) => (
              <motion.div
                key={step.step}
                variants={staggerItem}
                whileHover={{ y: -4 }}
                className="relative"
              >
                <div className="h-full p-8 rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-electric-blue/25 hover:border-electric-blue/50 transition-all duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <CheckCircle2 className="w-8 h-8 text-electric-blue-400" />
                    <span className="text-4xl font-extrabold text-slate-700">{step.step}</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-300">{step.description}</p>
                </div>
                {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-electric-blue to-transparent" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Certifications Section */}
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
              Certifications
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              Fully <span className="text-electric-blue">Certified</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          >
            {certifications.map((cert) => {
              const Icon = cert.icon
              return (
                <motion.div
                  key={cert.title}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                >
                  <div className="h-full p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-electric-blue/50 transition-all duration-300 shadow-lg hover:shadow-xl text-center">
                    <div className="w-16 h-16 rounded-xl bg-electric-blue/10 flex items-center justify-center mb-6 mx-auto">
                      <Icon className="w-8 h-8 text-electric-blue" />
                    </div>
                    <h3 className="text-xl font-extrabold text-navy mb-3">{cert.title}</h3>
                    <p className="text-slate-600">{cert.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-28 bg-gradient-to-b from-dark-charcoal-300 to-dark-charcoal-200">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              Need a <span className="text-electric-blue-400">Repair Quote?</span>
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Submit your repair request and our team will provide a detailed quote within hours.
            </p>
            <Button size="lg" onClick={() => setIsModalOpen(true)}>
              Request Repair Quote
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Repair Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Repair Quote"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="partNumber" className="block text-sm font-semibold text-navy mb-2">
              Part Number
            </label>
            <input
              type="text"
              id="partNumber"
              value={formData.partNumber}
              onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-navy mb-2">
              Component Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="aircraft" className="block text-sm font-semibold text-navy mb-2">
              Aircraft Type
            </label>
            <input
              type="text"
              id="aircraft"
              value={formData.aircraft}
              onChange={(e) => setFormData({ ...formData, aircraft: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="urgency" className="block text-sm font-semibold text-navy mb-2">
              Urgency
            </label>
            <select
              id="urgency"
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
              <option value="aog">AOG (Aircraft On Ground)</option>
            </select>
          </div>

          <div>
            <label htmlFor="contactName" className="block text-sm font-semibold text-navy mb-2">
              Contact Name
            </label>
            <input
              type="text"
              id="contactName"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-navy mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-navy mb-2">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full">
            Submit Request
          </Button>
        </form>
      </Modal>

      <Footer />
    </motion.main>
  )
}
