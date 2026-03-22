'use client'

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TypewriterTextProps {
  text: string | string[]
  speed?: number // milliseconds per character
  delay?: number // delay before starting
  className?: string
  onComplete?: () => void
  loop?: boolean
  showCursor?: boolean
}

export function TypewriterText({
  text,
  speed = 50,
  delay = 0,
  className,
  onComplete,
  loop = false,
  showCursor = true,
}: TypewriterTextProps) {
  const texts = Array.isArray(text) ? text : [text]
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    const currentText = texts[currentTextIndex]

    // Clear all existing timeouts when effect runs
    timeoutIdsRef.current.forEach(id => clearTimeout(id))
    timeoutIdsRef.current = []

    const addTimeout = (timeoutId: NodeJS.Timeout) => {
      timeoutIdsRef.current.push(timeoutId)
    }

    if (delay > 0 && displayedText === '') {
      const timeoutId = setTimeout(() => {
        startTyping()
      }, delay)
      addTimeout(timeoutId)
      return () => {
        timeoutIdsRef.current.forEach(id => clearTimeout(id))
        timeoutIdsRef.current = []
      }
    }

    function startTyping() {
      let charIndex = 0
      setIsTyping(true)

      const typeChar = () => {
        if (charIndex < currentText.length) {
          setDisplayedText(currentText.slice(0, charIndex + 1))
          charIndex++
          const timeoutId = setTimeout(typeChar, speed)
          addTimeout(timeoutId)
        } else {
          setIsTyping(false)
          if (currentTextIndex < texts.length - 1) {
            // Move to next text after a pause
            const timeoutId = setTimeout(() => {
              setDisplayedText('')
              setCurrentTextIndex((prev) => prev + 1)
            }, 1000)
            addTimeout(timeoutId)
          } else if (loop) {
            // Loop back to first text
            const timeoutId = setTimeout(() => {
              setDisplayedText('')
              setCurrentTextIndex(0)
            }, 1000)
            addTimeout(timeoutId)
          } else {
            onComplete?.()
          }
        }
      }

      typeChar()
    }

    if (displayedText === '' && delay === 0) {
      startTyping()
    }

    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id))
      timeoutIdsRef.current = []
    }
  }, [texts, currentTextIndex, speed, delay, displayedText, onComplete, loop])

  return (
    <span className={cn('inline-block', className)}>
      {displayedText}
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-block w-0.5 h-full bg-current ml-1"
        />
      )}
    </span>
  )
}
