'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function DetailDrawer({ open, onClose, title, subtitle, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Trap focus + close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-navy-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 right-0 h-full w-full sm:w-[600px] z-50 flex flex-col
          bg-navy-900 border-l border-navy-700/60
          shadow-[−20px_0_60px_rgba(0,0,0,0.5)]
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          background: 'linear-gradient(180deg, #132b51 0%, #0e2040 60%, #0a1a30 100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-navy-700/50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="block w-1 h-5 rounded-full bg-burgundy-600" aria-hidden="true" />
              <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
            </div>
            {subtitle && (
              <p className="text-xs text-navy-300 ml-3">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded text-navy-400 hover:text-white hover:bg-navy-700/60 transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </>
  )
}
