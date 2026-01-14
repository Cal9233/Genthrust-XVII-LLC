'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { staggerItem } from '@/lib/animations'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current && currentScrollY > 100

      setIsScrolled(currentScrollY > 50)
      setIsVisible(!scrollingDown || currentScrollY < 100)
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on escape
  useEffect(() => {
    if (!isMobileMenuOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMobileMenuOpen])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ 
        y: isVisible ? 0 : -100,
        backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.95)' : 'rgba(30, 41, 59, 0.8)',
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'backdrop-blur-xl border-b',
        isScrolled ? 'border-slate-200/60 shadow-lg' : 'border-transparent'
      )}
    >
      {/* Subtle technical pattern overlay (only when not scrolled) */}
      <AnimatePresence>
        {!isScrolled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.04 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(0,85,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,85,184,0.5) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        )}
      </AnimatePresence>
      <nav className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <motion.a 
            href="/" 
            className="flex items-center gap-3 group"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="relative w-11 h-11 overflow-hidden"
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src="/GenLogoTab.png"
                alt="GENTHRUST Logo"
                fill
                className="object-contain"
                priority
              />
            </motion.div>
            <span className={cn(
              'text-xl font-bold tracking-tight transition-colors',
              isScrolled ? 'text-navy group-hover:text-electric-blue' : 'text-white group-hover:text-electric-blue-300'
            )}>
              GENTHRUST
            </span>
          </motion.a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            {NAV_LINKS.map((link, index) => (
              <motion.a
                key={link.label}
                href={link.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'text-sm font-semibold uppercase tracking-wide transition-colors relative group',
                  isScrolled ? 'text-slate-700 hover:text-navy' : 'text-white/95 hover:text-white'
                )}
              >
                {link.label}
                <motion.span
                  className={cn(
                    'absolute -bottom-1 left-0 h-0.5',
                    isScrolled ? 'bg-electric-blue' : 'bg-electric-blue-400'
                  )}
                  initial={{ width: 0 }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
              </motion.a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button variant="outline" size="sm">
              Client Portal
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'md:hidden p-2 transition-colors',
              isScrolled ? 'text-navy hover:text-electric-blue' : 'text-white/90 hover:text-white'
            )}
            aria-label="Toggle menu"
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {isMobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-6 h-6" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="w-6 h-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden bg-white/98 backdrop-blur-xl border-b border-slate-200 shadow-lg overflow-hidden"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05,
                    delayChildren: 0.1,
                  },
                },
              }}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="container mx-auto px-4 py-6 flex flex-col gap-4"
            >
              {NAV_LINKS.map((link, index) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  variants={staggerItem}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-slate-600 hover:text-navy transition-colors py-2"
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.div
                variants={staggerItem}
                className="pt-4 border-t border-slate-200"
              >
                <Button variant="outline" size="md" className="w-full">
                  Client Portal
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
