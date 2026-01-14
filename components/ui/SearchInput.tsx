'use client'

import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, useState } from 'react'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
  dark?: boolean
}

export function SearchInput({ containerClassName, className, dark = false, ...props }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0)
    props.onChange?.(e)
  }

  return (
    <div className={cn('relative group w-full max-w-2xl', containerClassName)}>
      {/* Enhanced glow effect on focus */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: dark ? 0.5 : 0.3, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'absolute -inset-0.5 rounded-xl blur',
              dark
                ? 'bg-gradient-to-r from-electric-blue/50 via-electric-blue/30 to-electric-blue/50'
                : 'bg-gradient-to-r from-electric-blue/30 via-electric-blue/20 to-electric-blue/30'
            )}
          />
        )}
      </AnimatePresence>

      {/* Inner container */}
      <motion.div
        className={cn(
          'relative flex items-center',
          dark
            ? 'bg-slate-900/80 backdrop-blur-xl border-2 border-electric-blue/30 text-white'
            : 'bg-white/95 backdrop-blur-sm border-2 border-slate-300 text-navy',
          'rounded-xl',
          'shadow-lg',
          'transition-all duration-300'
        )}
        animate={{
          borderColor: isFocused
            ? dark
              ? 'rgba(0, 85, 184, 1)'
              : 'rgba(0, 85, 184, 1)'
            : dark
            ? 'rgba(0, 85, 184, 0.3)'
            : 'rgb(203, 213, 225)',
          boxShadow: isFocused
            ? dark
              ? '0 0 20px rgba(0, 85, 184, 0.4)'
              : '0 0 15px rgba(0, 85, 184, 0.2)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          scale: isFocused ? 1.01 : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{
            scale: isFocused ? 1.1 : 1,
            rotate: isFocused ? [0, -10, 10, 0] : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <Search
            className={cn(
              'w-5 h-5 ml-5 flex-shrink-0 transition-colors duration-300',
              isFocused
                ? dark
                  ? 'text-electric-blue-300'
                  : 'text-electric-blue'
                : dark
                ? 'text-electric-blue-400'
                : 'text-electric-blue'
            )}
          />
        </motion.div>
        <input
          type="text"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={handleChange}
          className={cn(
            'w-full px-4 py-4 md:py-5',
            'bg-transparent text-base md:text-lg',
            dark ? 'text-white placeholder:text-slate-400' : 'text-navy placeholder:text-slate-400',
            'focus:outline-none',
            className
          )}
          {...props}
        />
      </motion.div>
    </div>
  )
}
