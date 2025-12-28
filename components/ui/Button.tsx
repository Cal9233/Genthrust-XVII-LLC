'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'outline' | 'outline-red'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold tracking-wide uppercase transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white rounded-lg'

  const variants = {
    primary:
      'bg-electric-blue text-white hover:bg-electric-blue-600 hover:brightness-110 focus:ring-electric-blue shadow-lg hover:shadow-xl',
    outline:
      'bg-transparent border-2 border-electric-blue text-electric-blue hover:bg-electric-blue/10 focus:ring-electric-blue',
    'outline-red':
      'bg-transparent border-2 border-crimson text-crimson hover:bg-crimson/10 hover:shadow-[0_0_20px_rgba(185,28,28,0.4)] focus:ring-crimson',
  }

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}
