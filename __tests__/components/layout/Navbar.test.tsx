/**
 * Tests for components/layout/Navbar.tsx
 * Tests: renders logo, navigation links, Login link, mobile menu toggle.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

import { Navbar } from '@/components/layout/Navbar'

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

describe('Navbar logo', () => {
  it('renders the GENTHRUST brand name', () => {
    render(<Navbar />)
    expect(screen.getByText('GENTHRUST')).toBeInTheDocument()
  })

  it('renders the XVII designation', () => {
    render(<Navbar />)
    expect(screen.getByText('XVII')).toBeInTheDocument()
  })

  it('renders the logo as a link to home', () => {
    render(<Navbar />)
    const logoLink = screen.getByRole('link', { name: /genthrust/i })
    expect(logoLink).toHaveAttribute('href', '/')
  })
})

// ---------------------------------------------------------------------------
// Navigation links
// ---------------------------------------------------------------------------

describe('Navbar navigation links', () => {
  it('renders the About link', () => {
    render(<Navbar />)
    const links = screen.getAllByText('About')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/about')
  })

  it('renders the Services link', () => {
    render(<Navbar />)
    const links = screen.getAllByText('Services')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/services')
  })

  it('renders the Contact link', () => {
    render(<Navbar />)
    const links = screen.getAllByText('Contact')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/contact')
  })

  it('renders the Login link pointing to SSO', () => {
    render(<Navbar />)
    const loginLinks = screen.getAllByText('Login')
    expect(loginLinks.length).toBeGreaterThan(0)
    expect(loginLinks[0]).toHaveAttribute(
      'href',
      '/api/auth/signin/microsoft-entra-id?callbackUrl=%2Fapi%2Finternal%2Fsso%2Fflightdeck'
    )
  })
})

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------

describe('Navbar mobile menu', () => {
  it('renders the toggle menu button', () => {
    render(<Navbar />)
    expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument()
  })

  it('shows mobile navigation links when menu button is clicked', () => {
    render(<Navbar />)
    fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))
    // Links appear both in desktop and mobile menus
    expect(screen.getAllByText('About').length).toBeGreaterThan(1)
  })

  it('closes mobile menu on second click', () => {
    render(<Navbar />)
    const btn = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(btn) // open
    fireEvent.click(btn) // close
    // Only one instance of each nav link (desktop only)
    expect(screen.getAllByText('About').length).toBe(1)
  })

  it('shows Login link in mobile menu', () => {
    render(<Navbar />)
    fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))
    expect(screen.getAllByText('Login').length).toBeGreaterThan(1)
  })
})
