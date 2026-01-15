'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { fadeIn, fadeInUp, staggerGrid, staggerItem, slideInLeft, slideInRight, iconBounce } from '@/lib/animations'
import { FOOTER_LINKS } from '@/lib/constants'
import { Mail, Phone, MapPin, Clock, Send, MessageSquare } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'

const contactMethods = [
  {
    title: 'Email Us',
    description: FOOTER_LINKS.contact.email,
    icon: Mail,
    action: `mailto:${FOOTER_LINKS.contact.email}`,
  },
  {
    title: 'Call Us',
    description: FOOTER_LINKS.contact.phone,
    icon: Phone,
    action: `tel:${FOOTER_LINKS.contact.phone}`,
  },
  {
    title: 'Visit Us',
    description: FOOTER_LINKS.contact.address,
    icon: MapPin,
    action: '#',
  },
]

const officeHours = [
  { day: 'Monday - Friday', hours: '8:00 AM - 6:00 PM EST' },
  { day: 'Saturday', hours: '9:00 AM - 2:00 PM EST' },
  { day: 'Sunday', hours: 'Closed' },
  { day: 'Emergency AOG', hours: '24/7 Support Available' },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: '' })

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      setSubmitStatus({
        type: 'success',
        message: 'Message sent successfully! We will get back to you soon.',
      })
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: '',
        message: '',
      })
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send message. Please try again later.',
      })
    } finally {
      setIsSubmitting(false)
    }
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
              Get In Touch
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6"
            >
              <span className="text-white">LET'S TALK</span>
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
              Our team is ready to help you find solutions for your aviation needs.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Contact Methods */}
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
              Contact Information
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-navy mb-4">
              Reach Out <span className="text-electric-blue">To Us</span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerGrid}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20"
          >
            {contactMethods.map((method) => {
              const Icon = method.icon
              return (
                <motion.a
                  key={method.title}
                  href={method.action}
                  variants={staggerItem}
                  whileHover={{ y: -4 }}
                  className="block"
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
                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">{method.title}</h3>
                    <p className="text-slate-600">{method.description}</p>
                  </GlassCard>
                </motion.a>
              )
            })}
          </motion.div>

          {/* Contact Form and Office Hours */}
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <motion.div
              variants={slideInLeft}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
            >
              <h3 className="text-3xl font-extrabold text-navy mb-6">Send Us a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-navy mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-navy mb-2">
                      Email *
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
                </div>

                <div className="grid md:grid-cols-2 gap-6">
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
                    />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-semibold text-navy mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-navy mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-navy mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors"
                    required
                  />
                </div>

                {submitStatus.type && (
                  <div
                    className={`p-4 rounded-lg ${
                      submitStatus.type === 'success'
                        ? 'bg-green-50 border-2 border-green-200 text-green-800'
                        : 'bg-red-50 border-2 border-red-200 text-red-800'
                    }`}
                  >
                    <p className="font-semibold">{submitStatus.message}</p>
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  <Send className="w-5 h-5 mr-2" />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </motion.div>

            {/* Office Hours & Location */}
            <motion.div
              variants={slideInRight}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="space-y-8"
            >
              {/* Office Hours */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="w-6 h-6 text-electric-blue" />
                  <h3 className="text-3xl font-extrabold text-navy">Office Hours</h3>
                </div>
                <div className="space-y-4">
                  {officeHours.map((schedule, index) => (
                    <motion.div
                      key={schedule.day}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border-2 border-slate-200"
                    >
                      <span className="font-semibold text-navy">{schedule.day}</span>
                      <span className="text-slate-600">{schedule.hours}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Location Map */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-6 h-6 text-electric-blue" />
                  <h3 className="text-3xl font-extrabold text-navy">Our Location</h3>
                </div>
                <div className="relative h-64 rounded-2xl overflow-hidden border-2 border-slate-200">
                  <iframe
                    src="https://www.google.com/maps?q=9565+NW+40th+Street+Rd,+Doral,+FL&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                    title="Genthrust Location"
                  />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                      <p className="font-semibold text-navy">{FOOTER_LINKS.contact.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Contact */}
              <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-6 h-6 text-electric-blue-400" />
                  <h3 className="text-xl font-extrabold text-slate-900">Need Immediate Assistance?</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  For urgent AOG situations, call our 24/7 emergency line:
                </p>
                <a
                  href={`tel:${FOOTER_LINKS.contact.phone}`}
                  className="text-electric-blue-400 font-semibold text-lg hover:text-electric-blue-300 transition-colors"
                >
                  {FOOTER_LINKS.contact.phone}
                </a>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </motion.main>
  )
}
