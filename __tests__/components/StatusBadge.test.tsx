/**
 * Tests for components/internal/StatusBadge.tsx
 * Tests the statusToVariant mapping and StatusBadge/StatusDot rendering.
 * Uses jsdom environment for React component rendering.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import {
  StatusBadge,
  StatusDot,
  statusToVariant,
  type StatusVariant,
} from '@/components/internal/StatusBadge'

// ---------------------------------------------------------------------------
// statusToVariant — mapping logic
// ---------------------------------------------------------------------------

describe('statusToVariant — info variant', () => {
  it.each(['OPEN', 'ACTIVE', 'IN_PROGRESS', 'PENDING', 'UPCOMING', 'RUNNING'])(
    'maps %s to info',
    (status) => {
      expect(statusToVariant(status)).toBe('info')
    }
  )

  it('is case-insensitive for "open"', () => {
    expect(statusToVariant('open')).toBe('info')
  })

  it('handles "In Progress" with spaces', () => {
    expect(statusToVariant('In Progress')).toBe('info')
  })
})

describe('statusToVariant — success variant', () => {
  it.each(['COMPLETED', 'PAID', 'APPROVED', 'RECEIVED', 'DELIVERED_OK'])(
    'maps %s to success',
    (status) => {
      expect(statusToVariant(status)).toBe('success')
    }
  )

  it('maps "Completed" (mixed case) to success', () => {
    expect(statusToVariant('Completed')).toBe('success')
  })
})

describe('statusToVariant — shipped variant', () => {
  it.each(['SHIPPED', 'DELIVERED', 'IN_TRANSIT', 'DISPATCHED'])(
    'maps %s to shipped',
    (status) => {
      expect(statusToVariant(status)).toBe('shipped')
    }
  )
})

describe('statusToVariant — error variant', () => {
  it.each(['OVERDUE', 'PAST_DUE', 'CANCELLED', 'CANCELED', 'AOG', 'FAILED', 'STOPPED', 'REJECTED'])(
    'maps %s to error',
    (status) => {
      expect(statusToVariant(status)).toBe('error')
    }
  )
})

describe('statusToVariant — warning variant', () => {
  it.each(['DUE_SOON', 'WARNING', 'LIMITED', 'PARTIAL', 'UNKNOWN'])(
    'maps %s to warning',
    (status) => {
      expect(statusToVariant(status)).toBe('warning')
    }
  )
})

describe('statusToVariant — neutral variant', () => {
  it.each(['CLOSED', 'ARCHIVED', 'DRAFT', 'INACTIVE'])(
    'maps %s to neutral',
    (status) => {
      expect(statusToVariant(status)).toBe('neutral')
    }
  )
})

describe('statusToVariant — fallback heuristics', () => {
  it('maps unknown status with CANCEL in name to error', () => {
    expect(statusToVariant('AUTO_CANCELLED')).toBe('error')
  })

  it('maps unknown status with OVER in name to error', () => {
    expect(statusToVariant('OVERSTOCKED')).toBe('error')
  })

  it('maps unknown status with FAIL in name to error', () => {
    expect(statusToVariant('PAYMENT_FAILED')).toBe('error')
  })

  it('maps unknown status with WARN in name to warning', () => {
    expect(statusToVariant('STOCK_WARNING')).toBe('warning')
  })

  it('maps unknown status with SOON in name to warning', () => {
    expect(statusToVariant('EXPIRING_SOON')).toBe('warning')
  })

  it('maps unknown status with COMPLET in name to success', () => {
    expect(statusToVariant('AUTO_COMPLETED')).toBe('success')
  })

  it('maps unknown status with SHIP in name to shipped', () => {
    expect(statusToVariant('PARTIAL_SHIPPED')).toBe('shipped')
  })

  it('falls back to neutral for completely unrecognized status', () => {
    expect(statusToVariant('XYZZY_UNKNOWN_STATUS')).toBe('neutral')
  })
})

// ---------------------------------------------------------------------------
// StatusBadge component rendering
// ---------------------------------------------------------------------------

describe('StatusBadge rendering', () => {
  it('renders the status text as the label', () => {
    render(<StatusBadge status="OPEN" />)
    expect(screen.getByText('OPEN')).toBeInTheDocument()
  })

  it('replaces underscores with spaces in display label', () => {
    render(<StatusBadge status="PAST_DUE" />)
    expect(screen.getByText('PAST DUE')).toBeInTheDocument()
  })

  it('uses a custom label when provided', () => {
    render(<StatusBadge status="AOG" label="Aircraft on Ground" />)
    expect(screen.getByText('Aircraft on Ground')).toBeInTheDocument()
    expect(screen.queryByText('AOG')).not.toBeInTheDocument()
  })

  it('renders a dash when status is null', () => {
    render(<StatusBadge status={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a span element', () => {
    const { container } = render(<StatusBadge status="OPEN" />)
    expect(container.querySelector('span')).toBeInTheDocument()
  })

  it('does not render a badge chip when status is null', () => {
    const { container } = render(<StatusBadge status={null} />)
    // Should only have the dash span, not the colored badge structure
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// StatusDot component rendering
// ---------------------------------------------------------------------------

describe('StatusDot rendering', () => {
  it('renders the status label', () => {
    render(<StatusDot status="SHIPPED" />)
    expect(screen.getByText('SHIPPED')).toBeInTheDocument()
  })

  it('renders a dash when status is null', () => {
    render(<StatusDot status={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('uses custom label when provided', () => {
    render(<StatusDot status="DELIVERED" label="Delivered to Customer" />)
    expect(screen.getByText('Delivered to Customer')).toBeInTheDocument()
  })

  it('replaces underscores with spaces', () => {
    render(<StatusDot status="IN_TRANSIT" />)
    expect(screen.getByText('IN TRANSIT')).toBeInTheDocument()
  })
})
