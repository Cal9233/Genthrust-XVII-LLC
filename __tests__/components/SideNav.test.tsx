/**
 * Tests for components/internal/SideNav.tsx
 * Tests nav item rendering, collapse/expand toggle, active state,
 * user info display, and controlled vs uncontrolled collapse mode.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Next.js router hooks
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/internal'),
}))

// Mock next-auth signOut
vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}))

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

import SideNav from '@/components/internal/SideNav'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

// ---------------------------------------------------------------------------
// Nav item rendering
// ---------------------------------------------------------------------------

describe('SideNav nav items', () => {
  it('renders all 4 nav items', () => {
    render(<SideNav />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Bots')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(screen.getByText('Audit Log')).toBeInTheDocument()
  })

  it('renders nav links with correct hrefs', () => {
    render(<SideNav />)
    const dashLink = screen.getByText('Dashboard').closest('a')
    expect(dashLink).toHaveAttribute('href', '/internal')
  })

  it('marks the Dashboard link as active on /internal', () => {
    vi.mocked(usePathname).mockReturnValue('/internal')
    render(<SideNav />)
    const dashLink = screen.getByText('Dashboard').closest('a')
    expect(dashLink).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Bots link as active on /internal', () => {
    vi.mocked(usePathname).mockReturnValue('/internal')
    render(<SideNav />)
    const botsLink = screen.getByText('Bots').closest('a')
    expect(botsLink).not.toHaveAttribute('aria-current')
  })

  it('marks Bots as active when pathname starts with /internal/bots', () => {
    vi.mocked(usePathname).mockReturnValue('/internal/bots/chat')
    render(<SideNav />)
    const botsLink = screen.getByText('Bots').closest('a')
    expect(botsLink).toHaveAttribute('aria-current', 'page')
  })
})

// ---------------------------------------------------------------------------
// Collapse toggle — uncontrolled mode
// ---------------------------------------------------------------------------

describe('SideNav collapse toggle (uncontrolled)', () => {
  it('shows nav labels when not collapsed', () => {
    render(<SideNav />)
    expect(screen.getByText('Dashboard')).toBeVisible()
  })

  it('hides nav labels after collapsing', () => {
    render(<SideNav />)
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    // In collapsed state, label spans are conditionally rendered (not just hidden)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('toggles expand button label when collapsed', () => {
    render(<SideNav />)
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
  })

  it('restores nav labels after re-expanding', () => {
    render(<SideNav />)
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i })
    fireEvent.click(expandBtn)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Collapse toggle — controlled mode
// ---------------------------------------------------------------------------

describe('SideNav controlled collapse mode', () => {
  it('respects collapsed=true prop', () => {
    render(<SideNav collapsed={true} onCollapse={() => {}} />)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('respects collapsed=false prop', () => {
    render(<SideNav collapsed={false} onCollapse={() => {}} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('calls onCollapse with new state when toggle button is clicked', () => {
    const handleCollapse = vi.fn()
    render(<SideNav collapsed={false} onCollapse={handleCollapse} />)
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    expect(handleCollapse).toHaveBeenCalledWith(true)
  })
})

// ---------------------------------------------------------------------------
// User info display
// ---------------------------------------------------------------------------

describe('SideNav user info', () => {
  it('displays user name when provided', () => {
    render(<SideNav userName="John Doe" />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('displays user email when provided', () => {
    render(<SideNav userEmail="john@genthrust.net" />)
    expect(screen.getByText('john@genthrust.net')).toBeInTheDocument()
  })

  it('shows default initials GT when none provided', () => {
    render(<SideNav />)
    expect(screen.getByText('GT')).toBeInTheDocument()
  })

  it('shows custom initials when provided', () => {
    render(<SideNav userInitials="JD" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders user avatar image when userImage is provided', () => {
    render(<SideNav userImage="https://example.com/avatar.png" userName="Alice" />)
    const avatar = screen.getByAltText('Alice')
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png')
  })
})

// ---------------------------------------------------------------------------
// Sign out button
// ---------------------------------------------------------------------------

describe('SideNav sign out', () => {
  it('renders sign out button', () => {
    render(<SideNav />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls signOut when sign out button is clicked', () => {
    render(<SideNav />)
    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    fireEvent.click(signOutBtn)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })
})
