'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  label,
}: ToggleProps) {
  const sizeClasses = {
    sm: { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
  }

  const sizes = sizeClasses[size]

  return (
    <label className={cn('inline-flex items-center gap-3 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-electric-blue focus:ring-offset-2',
          sizes.track,
          checked ? 'bg-electric-blue' : 'bg-slate-300',
          disabled && 'cursor-not-allowed'
        )}
      >
        <motion.span
          className={cn('block rounded-full bg-white shadow-md', sizes.thumb)}
          animate={{
            x: checked ? sizes.translate.replace('translate-x-', '') : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      </button>
    </label>
  )
}
