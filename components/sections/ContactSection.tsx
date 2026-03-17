'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Mail, Clock, MapPin, Send, Loader2, CheckCircle } from 'lucide-react'
import { CONTACT_INFO } from '@/lib/constants'

const contactCards = [
  {
    icon: Phone,
    title: 'Call Us',
    content: (
      <ul className="space-y-1">
        {CONTACT_INFO.team.map((person) => (
          <li key={person.name}>
            <a
              href={`tel:${person.phone.replace(/[^+\d]/g, '')}`}
              className="hover:text-white transition-colors py-1.5 block"
            >
              {person.name}: {person.phone}
            </a>
          </li>
        ))}
      </ul>
    ),
  },
  {
    icon: Mail,
    title: 'Email Us',
    content: (
      <ul className="space-y-1">
        {CONTACT_INFO.team.map((person) => (
          <li key={person.email}>
            <a
              href={`mailto:${person.email}`}
              className="hover:text-white transition-colors py-1.5 block break-all"
            >
              {person.email}
            </a>
          </li>
        ))}
        <li>
          <a
            href={`mailto:${CONTACT_INFO.generalEmail}`}
            className="hover:text-white transition-colors py-1.5 block"
          >
            {CONTACT_INFO.generalEmail}
          </a>
        </li>
      </ul>
    ),
  },
  {
    icon: Clock,
    title: 'Business Hours',
    content: (
      <ul className="space-y-1">
        <li>{CONTACT_INFO.hours.weekdays}</li>
        <li>{CONTACT_INFO.hours.saturday}</li>
        <li>{CONTACT_INFO.hours.sunday}</li>
      </ul>
    ),
  },
  {
    icon: MapPin,
    title: 'Visit Us',
    content: <p>{CONTACT_INFO.address}</p>,
  },
]

export function ContactSection() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    partNumber: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitStatus('success')
      setFormData({ firstName: '', lastName: '', company: '', email: '', phone: '', partNumber: '', message: '' })
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors'

  return (
    <section id="contact" className="relative py-24 md:py-32 bg-navy-900">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Contact Us
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            Ready to source your next component? Our team is here to help with quotes,
            sourcing requests, and AOG support.
          </p>
        </motion.div>

        {/* Contact Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto mb-16">
          {contactCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-navy-800 border border-navy-700 rounded-lg p-4 md:p-6 hover:border-navy-600 hover:bg-navy-800/80 transition-all text-center"
            >
              <card.icon className="w-8 h-8 text-burgundy-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-3">
                {card.title}
              </h3>
              <div className="text-slate-300 text-sm min-w-0">
                {card.content}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <div className="bg-navy-800 border border-navy-700 rounded-lg p-6 md:p-8 hover:border-navy-600 transition-all">
            <h3 className="text-xl font-bold text-white mb-6 text-center">
              Request a Quote
            </h3>

            {submitStatus === 'success' ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Request submitted!</p>
                <p className="text-slate-400 text-sm">We'll get back to you within 2 hours.</p>
                <button
                  onClick={() => setSubmitStatus('idle')}
                  className="mt-4 text-sm text-burgundy-400 hover:text-burgundy-300 transition-colors"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="sr-only">First Name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="sr-only">Last Name</label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="company" className="sr-only">Company Name</label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder="Company Name"
                    value={formData.company}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="sr-only">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="sr-only">Phone Number</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="partNumber" className="sr-only">Part Name or Number</label>
                  <input
                    id="partNumber"
                    name="partNumber"
                    type="text"
                    placeholder="Part Name or Number"
                    value={formData.partNumber}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="message" className="sr-only">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    className={`${inputClass} resize-y`}
                  />
                </div>

                {submitStatus === 'error' && (
                  <p className="text-sm text-red-400 text-center">
                    Something went wrong. Please try again or call us directly.
                  </p>
                )}

                <div className="text-center">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-burgundy-600 hover:bg-burgundy-700 disabled:bg-burgundy-400 text-white font-semibold rounded-lg transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="w-full h-[250px] sm:h-[300px] md:h-[400px] rounded-lg overflow-hidden border border-navy-700">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3591.8!2d-80.3557!3d25.8085!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88d9b9c5a5a5a5a5%3A0x0!2s9565%20NW%2040th%20St%20Rd%2C%20Doral%2C%20FL%2033178!5e0!3m2!1sen!2sus!4v1704067200000"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="GENTHRUST XVII Location - 9565 NW 40 St Road, Doral, FL 33178"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
