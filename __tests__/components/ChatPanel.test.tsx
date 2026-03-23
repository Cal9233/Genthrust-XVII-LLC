/**
 * Tests for components/internal/ChatPanel.tsx
 * Tests: renders input/send button, shows empty state, sends message,
 * shows user message in list, calls fetch, handles errors.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// jsdom does not implement scrollIntoView — mock it globally
window.HTMLElement.prototype.scrollIntoView = vi.fn()

import ChatPanel from '@/components/internal/ChatPanel'

function makeFetchResponse(body: string, ok = true) {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(body)
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve({ error: 'Server error' }),
    body: stream,
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Rendering when open
// ---------------------------------------------------------------------------

describe('ChatPanel open state', () => {
  it('renders input field when open', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument()
  })

  it('renders send button when open', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('renders the AI Assistant header', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
  })

  it('shows empty state hint when no messages', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/ask about repair orders/i)).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Rendering when closed
// ---------------------------------------------------------------------------

describe('ChatPanel closed state', () => {
  it('does not render when open=false', () => {
    render(<ChatPanel open={false} onClose={vi.fn()} />)
    expect(screen.queryByPlaceholderText('Ask a question...')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------

describe('ChatPanel close button', () => {
  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<ChatPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close chat/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Minimize button
// ---------------------------------------------------------------------------

describe('ChatPanel minimize button', () => {
  it('renders minimize button', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /minimize chat/i })).toBeInTheDocument()
  })

  it('toggles to expand label after minimizing', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /minimize chat/i }))
    expect(screen.getByRole('button', { name: /expand chat/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Input interactions
// ---------------------------------------------------------------------------

describe('ChatPanel input', () => {
  it('enables send button when input has text', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'How many open ROs?' } })
    expect(screen.getByRole('button', { name: /send message/i })).not.toBeDisabled()
  })

  it('does not send empty/whitespace-only messages', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Message sending
// ---------------------------------------------------------------------------

describe('ChatPanel message flow', () => {
  it('adds user message to the list after sending', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(makeFetchResponse('Great question!'))
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'How many open ROs?' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(screen.getByText('How many open ROs?')).toBeInTheDocument()
  })

  it('clears input after sending', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(makeFetchResponse('OK'))
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(input).toHaveValue('')
  })

  it('sends message on Enter key', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockReturnValue(makeFetchResponse('Hi'))
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'What is inventory?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('does not send on Shift+Enter', () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Multi-line' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls /api/internal/chat endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockReturnValue(makeFetchResponse('Answer'))
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(fetchSpy).toHaveBeenCalledWith('/api/internal/chat', expect.objectContaining({
      method: 'POST',
    }))
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('ChatPanel error handling', () => {
  it('shows error message when fetch fails with non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(makeFetchResponse('{"error":"Unauthorized"}', false))
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await waitFor(() => {
      expect(screen.getByText(/error:/i)).toBeInTheDocument()
    })
  })
})
