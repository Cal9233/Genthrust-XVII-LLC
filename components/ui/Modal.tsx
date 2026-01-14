'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { modalBackdrop, modalContent, modalSlideIn } from '@/lib/animations'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  variant?: 'center' | 'slide-right'
  className?: string
  closeOnBackdropClick?: boolean
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  variant = 'center',
  className,
  closeOnBackdropClick = true,
}: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const contentVariants = variant === 'slide-right' ? modalSlideIn : modalContent

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={closeOnBackdropClick ? onClose : undefined}
          />

          {/* Modal Content */}
          <div
            className={cn(
              'fixed inset-0 z-[101] flex items-center justify-center p-4',
              variant === 'slide-right' && 'justify-end',
              className
            )}
            onClick={closeOnBackdropClick ? onClose : undefined}
          >
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto',
                variant === 'center' && 'max-w-lg w-full',
                variant === 'slide-right' && 'max-w-md w-full h-full rounded-r-none'
              )}
            >
              {/* Header */}
              {(title || closeOnBackdropClick) && (
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                  {title && <h2 className="text-2xl font-bold text-navy">{title}</h2>}
                  {closeOnBackdropClick && (
                    <button
                      onClick={onClose}
                      className="ml-auto p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5 text-slate-600" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
