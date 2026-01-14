'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-lg'
          : 'bg-dark-charcoal-200/80 backdrop-blur-sm'
      )}
    >
      {/* Subtle technical pattern overlay (only when not scrolled) */}
      {!isScrolled && (
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(0,85,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,85,184,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      )}
      <nav className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 overflow-hidden">
              <Image
                src="/GenLogoTab.png"
                alt="GENTHRUST Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className={cn(
              'text-xl font-bold tracking-tight transition-colors',
              isScrolled ? 'text-navy group-hover:text-electric-blue' : 'text-white group-hover:text-electric-blue-300'
            )}>
              GENTHRUST
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  'text-sm font-semibold uppercase tracking-wide transition-colors relative group',
                  isScrolled ? 'text-slate-700 hover:text-navy' : 'text-white/95 hover:text-white'
                )}
              >
                {link.label}
                <span className={cn(
                  'absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full',
                  isScrolled ? 'bg-electric-blue' : 'bg-electric-blue-400'
                )} />
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button variant="outline" size="sm">
              Client Portal
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'md:hidden p-2 transition-colors',
              isScrolled ? 'text-navy hover:text-electric-blue' : 'text-white/90 hover:text-white'
            )}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-white/98 backdrop-blur-xl border-b border-slate-200 shadow-lg"
          >
            <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-slate-600 hover:text-navy transition-colors py-2"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-slate-200">
                <Button variant="outline" size="md" className="w-full">
                  Client Portal
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
