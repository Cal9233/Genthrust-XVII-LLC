/**
 * Tests for components/internal/ChartCard.tsx
 * Tests: renders title/subtitle/icon, loading state, action slot, SectionDivider.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BarChart2 } from 'lucide-react'

import { ChartCard, SectionDivider } from '@/components/internal/ChartCard'

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('ChartCard loading state', () => {
  it('shows animate-pulse skeleton when loading=true', () => {
    const { container } = render(<ChartCard title="Revenue" loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('does not render title text when loading', () => {
    render(<ChartCard title="Revenue" loading />)
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Normal rendering
// ---------------------------------------------------------------------------

describe('ChartCard normal rendering', () => {
  it('renders the title', () => {
    render(<ChartCard title="Monthly Revenue" />)
    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<ChartCard title="Revenue" subtitle="Last 30 days" />)
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    render(<ChartCard title="Revenue" />)
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <ChartCard title="Stats">
        <div data-testid="chart-body">chart here</div>
      </ChartCard>
    )
    expect(screen.getByTestId('chart-body')).toBeInTheDocument()
  })

  it('renders action slot when provided', () => {
    render(
      <ChartCard
        title="Revenue"
        action={<button data-testid="action-btn">Export</button>}
      />
    )
    expect(screen.getByTestId('action-btn')).toBeInTheDocument()
  })

  it('does not render action slot when not provided', () => {
    render(<ChartCard title="Revenue" />)
    expect(screen.queryByTestId('action-btn')).not.toBeInTheDocument()
  })

  it('renders the icon component when provided', () => {
    const { container } = render(<ChartCard title="Revenue" icon={BarChart2} />)
    // Icon renders as an SVG element
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies custom className to the container', () => {
    const { container } = render(<ChartCard title="Revenue" className="col-span-2" />)
    expect(container.firstElementChild?.className).toContain('col-span-2')
  })
})

// ---------------------------------------------------------------------------
// SectionDivider
// ---------------------------------------------------------------------------

describe('SectionDivider', () => {
  it('renders the label text', () => {
    render(<SectionDivider label="Automation Rules" />)
    expect(screen.getByText('Automation Rules')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    const { container } = render(<SectionDivider label="Stats" icon={BarChart2} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without icon when not provided', () => {
    const { container } = render(<SectionDivider label="Stats" />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
