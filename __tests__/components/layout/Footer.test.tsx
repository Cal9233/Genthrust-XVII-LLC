/**
 * Tests for components/layout/Footer.tsx
 * Tests: renders company name, renders navigation links, renders copyright,
 * renders contact information.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}))

import { Footer } from '@/components/layout/Footer'

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

describe('Footer brand', () => {
  it('renders the GENTHRUST brand name', () => {
    render(<Footer />)
    expect(screen.getByText('GENTHRUST')).toBeInTheDocument()
  })

  it('renders the XVII designation', () => {
    render(<Footer />)
    expect(screen.getByText('XVII')).toBeInTheDocument()
  })

  it('renders the company logo image', () => {
    render(<Footer />)
    const logo = screen.getByAltText('GENTHRUST XVII Logo')
    expect(logo).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Navigation links
// ---------------------------------------------------------------------------

describe('Footer quick links', () => {
  it('renders Quick Links heading', () => {
    render(<Footer />)
    expect(screen.getByText('Quick Links')).toBeInTheDocument()
  })

  it('renders the Search Inventory link', () => {
    render(<Footer />)
    expect(screen.getByText('Search Inventory')).toBeInTheDocument()
  })

  it('renders the Request Quote link', () => {
    render(<Footer />)
    expect(screen.getByText('Request Quote')).toBeInTheDocument()
  })

  it('renders the About Us link', () => {
    render(<Footer />)
    expect(screen.getByText('About Us')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Contact info
// ---------------------------------------------------------------------------

describe('Footer contact information', () => {
  it('renders Contact heading', () => {
    render(<Footer />)
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('renders the Doral FL address', () => {
    render(<Footer />)
    expect(screen.getByText(/Doral, FL/)).toBeInTheDocument()
  })

  it('renders the phone number', () => {
    render(<Footer />)
    expect(screen.getByText(/786/)).toBeInTheDocument()
  })

  it('renders the sales email', () => {
    render(<Footer />)
    expect(screen.getByText('sales@genthrust.net')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Copyright
// ---------------------------------------------------------------------------

describe('Footer copyright', () => {
  it('renders the copyright text with current year', () => {
    render(<Footer />)
    const year = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument()
  })

  it('renders Privacy Policy link', () => {
    render(<Footer />)
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('renders Terms of Service link', () => {
    render(<Footer />)
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
  })

  it('renders the full company legal name', () => {
    render(<Footer />)
    expect(screen.getByText(/GENTHRUST XVII LLC/)).toBeInTheDocument()
  })
})
