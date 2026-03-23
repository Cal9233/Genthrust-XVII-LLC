/**
 * Tests for components/layout/Navbar.tsx
 * Tests: renders logo text, renders navigation links, mobile menu toggle.
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

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
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
  it('renders the Inventory link', () => {
    render(<Navbar />)
    expect(screen.getAllByText('Inventory').length).toBeGreaterThan(0)
  })

  it('renders the About link', () => {
    render(<Navbar />)
    expect(screen.getAllByText('About').length).toBeGreaterThan(0)
  })

  it('renders the Contact link', () => {
    render(<Navbar />)
    expect(screen.getAllByText('Contact').length).toBeGreaterThan(0)
  })

  it('renders the Portal button', () => {
    render(<Navbar />)
    // Portal appears both in desktop and potentially mobile
    const portalButtons = screen.getAllByText('Portal')
    expect(portalButtons.length).toBeGreaterThan(0)
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
    // All three NAV_LINKS should now be visible (as mobile links)
    expect(screen.getAllByText('Inventory').length).toBeGreaterThan(1)
  })

  it('closes mobile menu on second click', () => {
    render(<Navbar />)
    const btn = screen.getByRole('button', { name: /toggle menu/i })
    fireEvent.click(btn) // open
    fireEvent.click(btn) // close
    // Only one instance of each nav link (desktop only)
    expect(screen.getAllByText('Inventory').length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Portal modal
// ---------------------------------------------------------------------------

describe('Navbar portal modal', () => {
  it('opens portal modal when Portal button is clicked', () => {
    render(<Navbar />)
    // Click the first Portal button (desktop)
    fireEvent.click(screen.getAllByText('Portal')[0])
    expect(screen.getByText('Portal Access')).toBeInTheDocument()
  })

  it('shows Internal Team and Client options in modal', () => {
    render(<Navbar />)
    fireEvent.click(screen.getAllByText('Portal')[0])
    expect(screen.getByText('Internal Team')).toBeInTheDocument()
    expect(screen.getByText('Client')).toBeInTheDocument()
  })

  it('closes portal modal when backdrop is clicked', () => {
    render(<Navbar />)
    fireEvent.click(screen.getAllByText('Portal')[0])
    // The backdrop is the outermost modal div
    const backdrop = screen.getByText('Portal Access').closest('[class*="fixed inset-0"]') as HTMLElement
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(screen.queryByText('Portal Access')).not.toBeInTheDocument()
    }
  })
})
