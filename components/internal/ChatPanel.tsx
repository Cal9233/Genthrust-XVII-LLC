'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Send, Bot } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
}

export default function ChatPanel({ open, onClose }: ChatPanelProps) {
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, minimized])

  useEffect(() => {
    if (open && !minimized) {
      inputRef.current?.focus()
    }
  }, [open, minimized])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const resp = await fetch('/api/internal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${resp.status})`)
      }

      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantText += decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantText }
            return updated
          })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-panel"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: minimized ? 'calc(100% - 48px)' : 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="fixed bottom-0 right-6 w-[400px] h-[500px] bg-navy-900 border border-navy-700 rounded-t-xl z-50 flex flex-col shadow-2xl overflow-hidden"
          style={{ maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700 flex-shrink-0 bg-navy-900">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-burgundy-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white tracking-wide">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((v) => !v)}
                aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
                className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                aria-label="Close chat"
                className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-navy-700">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-xs mt-8 px-4 leading-relaxed">
                Ask about repair orders, inventory counts, open invoices, or anything about the business.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap font-mono ${
                    msg.role === 'user'
                      ? 'bg-burgundy-700 text-white rounded-br-sm'
                      : 'bg-navy-800 text-slate-100 rounded-bl-sm border border-navy-700'
                  }`}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1 items-center text-slate-400">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 py-3 border-t border-navy-700 bg-navy-900">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={loading}
                className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-horizon-blue-500 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="p-2 bg-burgundy-600 hover:bg-burgundy-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
