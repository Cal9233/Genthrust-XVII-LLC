'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Linkedin, Twitter, Send } from 'lucide-react'
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations'
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
    <footer className="relative bg-navy-dark border-t border-slate-800">
      {/* Gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-blue/50 to-transparent" />

      <div className="container mx-auto px-4 md:px-6 py-16">
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
            <div className="flex gap-4">
              <a
                href="#"
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-electric-blue/20 transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-electric-blue/20 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
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
              <div className="absolute -inset-0.5 bg-gradient-to-r from-electric-blue/30 to-electric-blue/10 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-slate-800/50 border border-white/10 rounded-l-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-electric-blue/50 transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="px-4 bg-electric-blue hover:bg-electric-blue-700 text-white rounded-r-lg transition-colors"
                  aria-label="Subscribe"
                >
                  <Send className="w-4 h-4" />
                </button>
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
