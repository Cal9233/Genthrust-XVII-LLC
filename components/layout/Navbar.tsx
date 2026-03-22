'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Shield, Users } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from '@/lib/constants'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false)
  const router = useRouter()

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
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-navy-900/95 backdrop-blur-sm border-b border-navy-800 shadow-lg'
          : 'bg-transparent'
      )}
    >
      <nav className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <span className={cn(
              "text-lg font-bold tracking-wider transition-colors",
              "text-white"
            )}>
              GENTHRUST
            </span>
            <span className={cn(
              "text-sm font-medium transition-colors",
              isScrolled ? "text-burgundy-400" : "text-aviation-red"
            )}>
              XVII
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors py-2 px-1",
                  isScrolled
                    ? "text-slate-300 hover:text-white"
                    : "text-silver/80 hover:text-white"
                )}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button
              onClick={() => setIsPortalModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-burgundy-600 rounded hover:bg-burgundy-700 transition-colors"
            >
              Portal
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "md:hidden p-3 transition-colors",
              isScrolled
                ? "text-slate-300 hover:text-white"
                : "text-silver hover:text-white"
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
            className="md:hidden bg-navy-900 border-b border-navy-800"
          >
            <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-lg font-medium text-slate-300 hover:text-white transition-colors py-3"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-navy-700">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    setIsPortalModalOpen(true)
                  }}
                  className="block w-full text-center px-4 py-3 text-sm font-medium text-white bg-burgundy-600 rounded hover:bg-burgundy-700 transition-colors"
                >
                  Portal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Portal Selection Modal */}
      <AnimatePresence>
        {isPortalModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setIsPortalModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-6">
                <Image
                  src="/GenLogoTab.png"
                  alt="GENTHRUST"
                  width={64}
                  height={64}
                  className="w-16 h-16"
                />
              </div>
              <h2 className="text-2xl font-extrabold text-navy-900 mb-2">Portal Access</h2>
              <p className="text-slate-600 mb-8 font-medium">Please select your access type to continue.</p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setIsPortalModalOpen(false)
                    router.push('/signin')
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
                >
                  <Shield className="w-5 h-5" />
                  Internal Team
                </button>
                <button
                  onClick={() => {
                    setIsPortalModalOpen(false)
                    router.push('/login')
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2"
                >
                  <Users className="w-5 h-5" />
                  Client
                </button>
              </div>

              <p className="text-xs text-slate-400 mt-6">
                Contact your administrator if you need access.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
