/**
 * Tests for components/portal/MfaChallenge.tsx
 * Tests: renders TOTP input, submits code, shows error prop,
 * toggles recovery code mode.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import MfaChallenge from '@/components/portal/MfaChallenge'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Initial rendering
// ---------------------------------------------------------------------------

describe('MfaChallenge rendering', () => {
  it('renders the Two-Factor Authentication heading', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
  })

  it('renders the authentication code input', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Authentication Code')).toBeInTheDocument()
  })

  it('renders the Verify submit button', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
  })

  it('verify button is disabled when input is empty', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled()
  })

  it('renders "Use a recovery code" toggle button', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.getByText(/use a recovery code/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TOTP code input validation
// ---------------------------------------------------------------------------

describe('MfaChallenge TOTP input', () => {
  it('strips non-digits from the code input', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '12a34b' } })
    expect(input).toHaveValue('1234')
  })

  it('enforces max length of 6 digits', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '1234567890' } })
    expect(input).toHaveValue('123456')
  })

  it('enables verify button when exactly 6 digits entered', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '123456' } })
    expect(screen.getByRole('button', { name: /verify/i })).not.toBeDisabled()
  })

  it('verify button disabled with fewer than 6 digits', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '12345' } })
    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

describe('MfaChallenge form submission', () => {
  it('calls onSubmit with the entered code', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MfaChallenge onSubmit={onSubmit} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '654321' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('654321')
    })
  })

  it('does not call onSubmit when code is empty', () => {
    const onSubmit = vi.fn()
    render(<MfaChallenge onSubmit={onSubmit} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Error prop display
// ---------------------------------------------------------------------------

describe('MfaChallenge error display', () => {
  it('shows the error message when error prop is provided', () => {
    render(<MfaChallenge onSubmit={vi.fn()} error="Invalid code. Please try again." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code. Please try again.')
  })

  it('does not show alert element when no error prop', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Recovery code mode
// ---------------------------------------------------------------------------

describe('MfaChallenge recovery code mode', () => {
  it('switches to recovery code mode when toggle is clicked', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByText(/use a recovery code/i))
    expect(screen.getByLabelText('Recovery Code')).toBeInTheDocument()
  })

  it('updates toggle button text in recovery mode', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByText(/use a recovery code/i))
    expect(screen.getByText(/use authenticator app instead/i)).toBeInTheDocument()
  })

  it('sets aria-pressed on toggle button', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: /use a recovery code/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /use authenticator app instead/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears the code input when switching modes', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('Authentication Code')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByText(/use a recovery code/i))
    expect(screen.getByLabelText('Recovery Code')).toHaveValue('')
  })

  it('enables verify in recovery mode when text is entered', () => {
    render(<MfaChallenge onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByText(/use a recovery code/i))
    const input = screen.getByLabelText('Recovery Code')
    fireEvent.change(input, { target: { value: 'ABCD-EFGH' } })
    expect(screen.getByRole('button', { name: /verify/i })).not.toBeDisabled()
  })

  it('calls onSubmit with recovery code', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MfaChallenge onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText(/use a recovery code/i))
    const input = screen.getByLabelText('Recovery Code')
    fireEvent.change(input, { target: { value: 'ABCD-EFGH' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('ABCD-EFGH')
    })
  })
})
