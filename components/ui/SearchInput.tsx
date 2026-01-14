'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, useState } from 'react'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
  dark?: boolean
}

export function SearchInput({ containerClassName, className, dark = false, ...props }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className={cn('relative group w-full max-w-2xl', containerClassName)}>
      {/* Glow effect on focus */}
      {isFocused && dark && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-electric-blue/50 via-electric-blue/30 to-electric-blue/50 rounded-xl blur opacity-50 animate-pulse" />
      )}
      
      {/* Inner container */}
      <div
        className={cn(
          'relative flex items-center',
          dark
            ? 'bg-slate-900/80 backdrop-blur-xl border-2 border-electric-blue/30 text-white'
            : 'bg-white/95 backdrop-blur-sm border-2 border-slate-300 text-navy',
          'rounded-xl',
          'shadow-lg',
          'transition-all duration-300',
          isFocused && dark && 'border-electric-blue shadow-glow-blue-input',
          isFocused && !dark && 'border-electric-blue shadow-blue-accent'
        )}
      >
        <Search className={cn('w-5 h-5 ml-5 flex-shrink-0', dark ? 'text-electric-blue-400' : 'text-electric-blue')} />
        <input
          type="text"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'w-full px-4 py-4 md:py-5',
            'bg-transparent text-base md:text-lg',
            dark ? 'text-white placeholder:text-slate-400' : 'text-navy placeholder:text-slate-400',
            'focus:outline-none',
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}
