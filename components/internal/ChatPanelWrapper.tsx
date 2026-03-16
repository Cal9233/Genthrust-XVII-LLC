'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import ChatPanel from '@/components/internal/ChatPanel'

export default function ChatPanelWrapper() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI chat"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-burgundy-600 hover:bg-burgundy-500 active:bg-burgundy-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center group"
      >
        <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform duration-150" />
      </button>
      <ChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
