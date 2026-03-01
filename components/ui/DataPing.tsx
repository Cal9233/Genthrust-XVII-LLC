'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DataPingProps {
  className?: string
  interval?: number
  prefix?: string
}

function generateRandomHex(): string {
  return Math.random().toString(16).substring(2, 6).toUpperCase()
}

function generatePartNumber(): string {
  const prefixes = ['PN', 'SN', 'REF', 'ASY']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const num1 = Math.floor(Math.random() * 999).toString().padStart(3, '0')
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const num2 = Math.floor(Math.random() * 99).toString().padStart(2, '0')
  return `${prefix}: ${num1}-${letter}${num2}`
}

export function DataPing({ className, interval = 2500, prefix }: DataPingProps) {
  const [value, setValue] = useState('')
  const [isFlickering, setIsFlickering] = useState(false)

  const updateValue = useCallback(() => {
    setIsFlickering(true)
    setTimeout(() => {
      setValue(prefix ? `${prefix}: ${generateRandomHex()}` : generatePartNumber())
      setTimeout(() => setIsFlickering(false), 150)
    }, 150)
  }, [prefix])

  useEffect(() => {
    updateValue()
    const timer = setInterval(updateValue, interval)
    return () => clearInterval(timer)
  }, [updateValue, interval])

  return (
    <div className={cn('font-mono text-[10px] text-horizon-blue/60', className)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: isFlickering ? 0.2 : 0.6 }}
          exit={{ opacity: 0.2 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-1"
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-colors duration-150',
              isFlickering ? 'bg-horizon-blue/30' : 'bg-horizon-blue/60'
            )}
          />
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
