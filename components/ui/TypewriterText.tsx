'use client'

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const currentText = texts[currentTextIndex]
    let timeoutId: NodeJS.Timeout

    if (delay > 0 && displayedText === '') {
      timeoutId = setTimeout(() => {
        startTyping()
      }, delay)
      return () => clearTimeout(timeoutId)
    }

    function startTyping() {
      let charIndex = 0
      setIsTyping(true)

      const typeChar = () => {
        if (charIndex < currentText.length) {
          setDisplayedText(currentText.slice(0, charIndex + 1))
          charIndex++
          timeoutId = setTimeout(typeChar, speed)
        } else {
          setIsTyping(false)
          if (currentTextIndex < texts.length - 1) {
            // Move to next text after a pause
            setTimeout(() => {
              setDisplayedText('')
              setCurrentTextIndex((prev) => prev + 1)
            }, 1000)
          } else if (loop) {
            // Loop back to first text
            setTimeout(() => {
              setDisplayedText('')
              setCurrentTextIndex(0)
            }, 1000)
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
      if (timeoutId) clearTimeout(timeoutId)
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
