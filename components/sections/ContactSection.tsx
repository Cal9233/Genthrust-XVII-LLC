'use client'

import { motion } from 'framer-motion'
import { Phone, Mail, Clock, MapPin, Send } from 'lucide-react'
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
              className="hover:text-white transition-colors py-1.5 block"
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
  return (
    <section id="contact" className="relative py-20 bg-navy-900">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Contact Us
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto">
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
              <div className="w-12 h-12 bg-burgundy-600/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <card.icon className="w-6 h-6 text-burgundy-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">
                {card.title}
              </h3>
              <div className="text-slate-300 text-sm">
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

            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Company Name"
                className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Part Name or Number"
                className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors"
              />
              <textarea
                placeholder="Message"
                rows={4}
                className="w-full px-4 py-3 bg-navy-700 border border-navy-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:border-transparent transition-colors resize-none"
              />
              <div className="text-center">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-burgundy-600 hover:bg-burgundy-700 text-white font-semibold rounded transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Submit Request
                </button>
              </div>
            </form>
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
              src="https://www.google.com/maps?q=9565+NW+40th+St+Rd,+Doral,+FL+33178&output=embed"
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
