/**
 * Tests for components/internal/StatCard.tsx
 * Tests loading state skeleton, numeric vs string values, trend indicators,
 * subtitle rendering, and click handler behavior.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Package } from 'lucide-react'

// Mock framer-motion to avoid IntersectionObserver dependency in jsdom
vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
  AnimatePresence: ({ children }: any) => children,
}))

import { StatCard, StatCardSkeleton } from '@/components/internal/StatCard'

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

describe('StatCard loading state', () => {
  it('renders the skeleton when loading=true', () => {
    const { container } = render(
      <StatCard icon={Package} label="Test" value={0} color="#fff" loading />
    )
    // Skeleton has animate-pulse class
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('does not render the label text when loading', () => {
    render(<StatCard icon={Package} label="Revenue" value={100} color="#fff" loading />)
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// StatCardSkeleton
// ---------------------------------------------------------------------------

describe('StatCardSkeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<StatCardSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// StatCard normal rendering
// ---------------------------------------------------------------------------

describe('StatCard rendering', () => {
  it('renders the label text', () => {
    render(<StatCard icon={Package} label="Open Orders" value={42} color="#3fb950" />)
    // Label is rendered as-is; CSS `uppercase` applies visual transform only
    expect(screen.getByText('Open Orders')).toBeInTheDocument()
  })

  it('renders a string value directly', () => {
    render(<StatCard icon={Package} label="Status" value="Active" color="#fff" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(
      <StatCard icon={Package} label="Orders" value={10} color="#fff" subtitle="Last 30 days" />
    )
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('renders the trend label when provided', () => {
    render(
      <StatCard
        icon={Package}
        label="Revenue"
        value={1000}
        color="#fff"
        trend={{ value: 5, label: 'vs last month' }}
      />
    )
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('renders positive trend percentage', () => {
    render(
      <StatCard
        icon={Package}
        label="Revenue"
        value={1000}
        color="#fff"
        trend={{ value: 12 }}
      />
    )
    expect(screen.getByText('12%')).toBeInTheDocument()
  })

  it('renders negative trend percentage as absolute value', () => {
    render(
      <StatCard
        icon={Package}
        label="Revenue"
        value={500}
        color="#fff"
        trend={{ value: -8 }}
      />
    )
    expect(screen.getByText('8%')).toBeInTheDocument()
  })

  it('renders zero trend percentage', () => {
    render(
      <StatCard
        icon={Package}
        label="Revenue"
        value={500}
        color="#fff"
        trend={{ value: 0 }}
      />
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('does not render subtitle area when neither subtitle nor trend.label provided', () => {
    render(<StatCard icon={Package} label="Count" value={5} color="#fff" />)
    // No trend label or subtitle text should appear
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// StatCard interactivity
// ---------------------------------------------------------------------------

describe('StatCard onClick', () => {
  it('calls onClick when the card is clicked', () => {
    const handleClick = vi.fn()
    render(
      <StatCard icon={Package} label="Clickable" value={0} color="#fff" onClick={handleClick} />
    )
    const card = screen.getByText('Clickable').closest('div')!
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('has cursor-pointer class when onClick is provided', () => {
    const { container } = render(
      <StatCard icon={Package} label="Card" value={1} color="#fff" onClick={() => {}} />
    )
    expect(container.querySelector('.cursor-pointer')).toBeInTheDocument()
  })

  it('does not have cursor-pointer class when onClick is absent', () => {
    const { container } = render(
      <StatCard icon={Package} label="Card" value={1} color="#fff" />
    )
    // The outer div should not have cursor-pointer
    const outerDiv = container.firstElementChild
    expect(outerDiv?.className).not.toContain('cursor-pointer')
  })
})
