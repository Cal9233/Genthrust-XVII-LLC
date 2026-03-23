/**
 * Tests for components/portal/MfaEnrollment.tsx
 * Tests: initial loading state, QR code step, verify input, error display,
 * recovery step, and API call behavior.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Stub clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

beforeEach(() => {
  vi.restoreAllMocks()
})

import MfaEnrollment from '@/components/portal/MfaEnrollment'

// ---------------------------------------------------------------------------
// Loading state (initial mount calls fetch)
// ---------------------------------------------------------------------------

describe('MfaEnrollment initial state', () => {
  it('shows loading spinner on mount before fetch resolves', () => {
    // Fetch that never resolves
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { container } = render(<MfaEnrollment onComplete={vi.fn()} />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('calls /api/portal/mfa/enroll on mount', () => {
    const fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    render(<MfaEnrollment onComplete={vi.fn()} />)
    expect(fetchMock).toHaveBeenCalledWith('/api/portal/mfa/enroll', expect.objectContaining({ method: 'POST' }))
  })
})

// ---------------------------------------------------------------------------
// QR step (after successful enroll fetch)
// ---------------------------------------------------------------------------

describe('MfaEnrollment QR step', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/portal/mfa/enroll') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ qrCodeUrl: 'https://example.com/qr.png', secret: 'ABCDEFGH' }),
        } as any)
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any)
    }))
  })

  it('renders the setup heading after enroll succeeds', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument()
    })
  })

  it('renders the QR code image', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => {
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/qr.png')
    })
  })

  it('renders the manual secret key', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('ABCDEFGH')).toBeInTheDocument()
    })
  })

  it('renders the verify input field', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByLabelText(/enter the 6-digit code/i)).toBeInTheDocument()
    })
  })

  it('verify button is disabled when code is less than 6 digits', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '123' } })
    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled()
  })

  it('verify button is enabled with 6 digits', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '123456' } })
    expect(screen.getByRole('button', { name: /verify/i })).not.toBeDisabled()
  })

  it('strips non-digit characters from the code input', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '12a34b' } })
    expect(input).toHaveValue('1234')
  })
})

// ---------------------------------------------------------------------------
// Verification step
// ---------------------------------------------------------------------------

describe('MfaEnrollment verification', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/portal/mfa/enroll') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ qrCodeUrl: 'data:image/png;base64,abc', secret: 'SECRET123' }),
        } as any)
      }
      if (url === '/api/portal/mfa/verify') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recoveryCodes: ['CODE-1', 'CODE-2', 'CODE-3'] }),
        } as any)
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as any)
    }))
  })

  it('calls /api/portal/mfa/verify with the entered code', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/portal/mfa/enroll') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ qrCodeUrl: 'x', secret: 'Y' }),
        } as any)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ recoveryCodes: ['A', 'B'] }),
      } as any)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '654321' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const calls = fetchMock.mock.calls
      const verifyCall = calls.find((c) => c[0] === '/api/portal/mfa/verify')
      expect(verifyCall).toBeDefined()
      const body = JSON.parse(verifyCall![1].body)
      expect(body.code).toBe('654321')
    })
  })

  it('shows recovery codes step after successful verification', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('MFA Enabled Successfully')).toBeInTheDocument()
    })
  })

  it('shows recovery codes in the recovery step', async () => {
    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('CODE-1')).toBeInTheDocument()
      expect(screen.getByText('CODE-2')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('MfaEnrollment error handling', () => {
  it('shows error message when verify call fails', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/portal/mfa/enroll') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ qrCodeUrl: 'x', secret: 'Y' }),
        } as any)
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid TOTP code' }),
      } as any)
    }))

    render(<MfaEnrollment onComplete={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Invalid TOTP code')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Recovery step: continue button
// ---------------------------------------------------------------------------

describe('MfaEnrollment recovery step actions', () => {
  it('calls onComplete when "I\'ve Saved My Codes" button is clicked', async () => {
    const onComplete = vi.fn()
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/portal/mfa/enroll') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ qrCodeUrl: 'x', secret: 'Y' }),
        } as any)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ recoveryCodes: ['A', 'B'] }),
      } as any)
    }))

    render(<MfaEnrollment onComplete={onComplete} />)
    await waitFor(() => screen.getByLabelText(/enter the 6-digit code/i))
    const input = screen.getByLabelText(/enter the 6-digit code/i)
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => screen.getByText(/I've Saved My Codes/))
    fireEvent.click(screen.getByText(/I've Saved My Codes/))
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
