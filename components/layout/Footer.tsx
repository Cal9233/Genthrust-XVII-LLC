'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Linkedin, Twitter, Send } from 'lucide-react'
import { fadeInUp, staggerContainer, staggerItem, iconRotate, scaleIn } from '@/lib/animations'
import { FOOTER_LINKS } from '@/lib/constants'
import { useState } from 'react'

export function Footer() {
  const [email, setEmail] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle newsletter signup
    console.log('Newsletter signup:', email)
    setEmail('')
  }

  return (
    <footer className="relative bg-gradient-to-b from-midnight-blue-200 to-dark-charcoal-200 border-t border-electric-blue/20">
      {/* Enhanced gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-blue/60 to-transparent" />
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-electric opacity-30" />
      {/* Subtle technical pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,85,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,85,184,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="container mx-auto px-4 md:px-6 py-16 relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12"
        >
          {/* Logo & About */}
          <motion.div variants={staggerItem} className="lg:col-span-1">
            <a href="/" className="flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10 overflow-hidden">
                <Image
                  src="/GenLogoTab.png"
                  alt="GENTHRUST Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">GENTHRUST</span>
            </a>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Powering global aviation with certified parts, expert repairs, and reliable supply
              chain solutions.
            </p>
            <div className="flex gap-3">
              <motion.a
                href="#"
                variants={iconRotate}
                initial="rest"
                whileHover="hover"
                className="p-2.5 rounded-lg bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-white hover:bg-electric-blue/30 hover:border-electric-blue/50 hover:shadow-glow-blue transition-all duration-300"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </motion.a>
              <motion.a
                href="#"
                variants={iconRotate}
                initial="rest"
                whileHover="hover"
                className="p-2.5 rounded-lg bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-white hover:bg-electric-blue/30 hover:border-electric-blue/50 hover:shadow-glow-blue transition-all duration-300"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </motion.a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={staggerItem}>
            <h4 className="text-white font-semibold mb-6 uppercase text-sm tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div variants={staggerItem}>
            <h4 className="text-white font-semibold mb-6 uppercase text-sm tracking-wider">
              Contact
            </h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>{FOOTER_LINKS.contact.address}</li>
              <li>
                <a href={`tel:${FOOTER_LINKS.contact.phone}`} className="hover:text-white transition-colors">
                  {FOOTER_LINKS.contact.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${FOOTER_LINKS.contact.email}`} className="hover:text-white transition-colors">
                  {FOOTER_LINKS.contact.email}
                </a>
              </li>
            </ul>
          </motion.div>

          {/* Newsletter */}
          <motion.div variants={staggerItem}>
            <h4 className="text-white font-semibold mb-6 uppercase text-sm tracking-wider">
              Stay Updated
            </h4>
            <p className="text-slate-400 text-sm mb-4">
              Subscribe for aviation insights and inventory updates.
            </p>
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-electric-blue/50 to-electric-blue/30 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
              <div className="relative flex">
                <motion.input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-slate-800/70 backdrop-blur-sm border border-white/10 rounded-l-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-electric-blue/60 focus:shadow-glow-blue-input transition-all duration-300"
                  required
                  whileFocus={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-5 bg-electric-blue hover:bg-electric-blue-600 hover:shadow-glow-blue text-white rounded-r-lg transition-all duration-300 flex items-center justify-center"
                  aria-label="Subscribe"
                >
                  <motion.div
                    animate={{ x: email ? [0, 4, 0] : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Send className="w-4 h-4" />
                  </motion.div>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} GENTHRUST. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">
              Terms of Service
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
