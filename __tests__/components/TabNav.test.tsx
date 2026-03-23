/**
 * Tests for components/internal/TabNav.tsx
 * Tests: renders all 6 tabs, highlights active tab via aria-current,
 * mobile menu opens/closes via hamburger button.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/internal',
  useRouter: () => ({ push: vi.fn() }),
}))

import TabNav from '@/components/internal/TabNav'

// ---------------------------------------------------------------------------
// Tab rendering
// ---------------------------------------------------------------------------

describe('TabNav tab rendering', () => {
  it('renders all 6 navigation tabs', () => {
    render(<TabNav />)
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bots').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ERP').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Automation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Clients').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Audit Log').length).toBeGreaterThan(0)
  })

  it('renders nav element with accessible label', () => {
    render(<TabNav />)
    const navs = screen.getAllByRole('navigation', { name: /main navigation/i })
    expect(navs.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Active tab highlighting
// ---------------------------------------------------------------------------

describe('TabNav active tab', () => {
  it('marks the Dashboard tab as current page when pathname is /internal', () => {
    render(<TabNav />)
    // The desktop nav link for Dashboard should have aria-current="page"
    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i })
    const activeLink = dashboardLinks.find(
      (link) => link.getAttribute('aria-current') === 'page'
    )
    expect(activeLink).toBeDefined()
  })

  it('does not mark Bots as active when pathname is /internal', () => {
    render(<TabNav />)
    const botsLinks = screen.getAllByRole('link', { name: /bots/i })
    const activeBotsLink = botsLinks.find(
      (link) => link.getAttribute('aria-current') === 'page'
    )
    expect(activeBotsLink).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------

describe('TabNav mobile menu', () => {
  it('shows Open navigation button initially', () => {
    render(<TabNav />)
    expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument()
  })

  it('opens mobile menu when hamburger button is clicked', () => {
    render(<TabNav />)
    const openBtn = screen.getByRole('button', { name: /open navigation/i })
    fireEvent.click(openBtn)
    // After opening, aria-expanded should be true
    expect(openBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('changes button label to Close navigation after opening', () => {
    render(<TabNav />)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(screen.getByRole('button', { name: /close navigation/i })).toBeInTheDocument()
  })

  it('closes mobile menu on second click', () => {
    render(<TabNav />)
    const btn = screen.getByRole('button', { name: /open navigation/i })
    fireEvent.click(btn) // open
    fireEvent.click(screen.getByRole('button', { name: /close navigation/i })) // close
    expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument()
  })
})
