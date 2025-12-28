'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InputHTMLAttributes, useState } from 'react'

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string
}

export function SearchInput({ containerClassName, className, ...props }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className={cn('relative group w-full max-w-2xl', containerClassName)}>
      {/* Inner container */}
      <div
        className={cn(
          'relative flex items-center',
          'bg-white',
          'border-2 border-slate-300',
          'rounded-xl',
          'shadow-lg',
          'transition-all duration-300',
          isFocused && 'border-electric-blue shadow-blue-accent'
        )}
      >
        <Search className="w-5 h-5 text-electric-blue ml-5 flex-shrink-0" />
        <input
          type="text"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'w-full px-4 py-4 md:py-5',
            'bg-transparent text-navy text-base md:text-lg',
            'placeholder:text-slate-400',
            'focus:outline-none',
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}
