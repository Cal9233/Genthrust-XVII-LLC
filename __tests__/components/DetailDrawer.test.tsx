/**
 * Tests for components/internal/DetailDrawer.tsx
 * Tests: opens/closes, Escape key closes, renders children,
 * DrawerMetaGrid renders fields, DrawerLineItems renders table.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import DetailDrawer, { DrawerMetaGrid, DrawerLineItems } from '@/components/internal/DetailDrawer'

// ---------------------------------------------------------------------------
// DetailDrawer open/closed state
// ---------------------------------------------------------------------------

describe('DetailDrawer open state', () => {
  it('renders the dialog element regardless of open state', () => {
    render(<DetailDrawer open={false} onClose={vi.fn()} title="Test Drawer"><p>content</p></DetailDrawer>)
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument()
  })

  it('shows the title when open', () => {
    render(<DetailDrawer open={true} onClose={vi.fn()} title="RO-00123"><p>body</p></DetailDrawer>)
    expect(screen.getByText('RO-00123')).toBeInTheDocument()
  })

  it('shows the subtitle when provided', () => {
    render(
      <DetailDrawer open={true} onClose={vi.fn()} title="RO-00123" subtitle="Repair Order">
        <p>body</p>
      </DetailDrawer>
    )
    expect(screen.getByText('Repair Order')).toBeInTheDocument()
  })

  it('does not show subtitle when not provided', () => {
    render(<DetailDrawer open={true} onClose={vi.fn()} title="RO-00123"><p>body</p></DetailDrawer>)
    // Subtitle element should not be present
    expect(screen.queryByText('Repair Order')).not.toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <DetailDrawer open={true} onClose={vi.fn()} title="Test">
        <span data-testid="child-content">Hello from child</span>
      </DetailDrawer>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------

describe('DetailDrawer close button', () => {
  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    render(<DetailDrawer open={true} onClose={onClose} title="Test"><p>body</p></DetailDrawer>)
    fireEvent.click(screen.getByRole('button', { name: /close drawer/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <DetailDrawer open={true} onClose={onClose} title="Test"><p>body</p></DetailDrawer>
    )
    // The backdrop is the first fixed div with aria-hidden
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Escape key
// ---------------------------------------------------------------------------

describe('DetailDrawer Escape key', () => {
  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn()
    render(<DetailDrawer open={true} onClose={onClose} title="Test"><p>body</p></DetailDrawer>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when Escape is pressed while closed', () => {
    const onClose = vi.fn()
    render(<DetailDrawer open={false} onClose={onClose} title="Test"><p>body</p></DetailDrawer>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DrawerMetaGrid
// ---------------------------------------------------------------------------

describe('DrawerMetaGrid', () => {
  const fields = [
    { label: 'RO Number', value: 'RO-00123' },
    { label: 'Status', value: 'Open' },
    { label: 'Customer', value: 'Acme Corp' },
  ]

  it('renders all field labels', () => {
    render(<DrawerMetaGrid fields={fields} />)
    expect(screen.getByText('RO Number')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Customer')).toBeInTheDocument()
  })

  it('renders all field values', () => {
    render(<DrawerMetaGrid fields={fields} />)
    expect(screen.getByText('RO-00123')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('renders React node values', () => {
    const fields = [{ label: 'Status', value: <span data-testid="badge">Active</span> }]
    render(<DrawerMetaGrid fields={fields} />)
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('renders empty grid for empty fields array', () => {
    const { container } = render(<DrawerMetaGrid fields={[]} />)
    expect(container.querySelector('.grid')).toBeInTheDocument()
    expect(container.querySelectorAll('.bg-\\[\\#0b0f14\\]').length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// DrawerLineItems
// ---------------------------------------------------------------------------

describe('DrawerLineItems', () => {
  const columns = [
    { key: 'pn', label: 'Part Number' },
    { key: 'qty', label: 'Qty', align: 'right' as const },
    { key: 'price', label: 'Price', align: 'right' as const },
  ]

  const rows = [
    { pn: 'CFM56-P001', qty: 2, price: 1500 },
    { pn: 'APU-S001', qty: 1, price: 800 },
  ]

  it('renders column headers', () => {
    render(<DrawerLineItems columns={columns} rows={rows} />)
    expect(screen.getByText('Part Number')).toBeInTheDocument()
    expect(screen.getByText('Qty')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
  })

  it('renders all row data', () => {
    render(<DrawerLineItems columns={columns} rows={rows} />)
    expect(screen.getByText('CFM56-P001')).toBeInTheDocument()
    expect(screen.getByText('APU-S001')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows empty state when rows is empty', () => {
    render(<DrawerLineItems columns={columns} rows={[]} />)
    expect(screen.getByText('No items')).toBeInTheDocument()
  })

  it('renders em-dash for missing cell values', () => {
    const sparseRows = [{ pn: 'TEST-001' }] // qty and price missing
    render(<DrawerLineItems columns={columns} rows={sparseRows as any} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(2)
  })

  it('uses render function when provided', () => {
    const colsWithRender = [
      { key: 'pn', label: 'Part Number' },
      {
        key: 'price',
        label: 'Price',
        render: (row: any) => <span data-testid="formatted-price">${row.price}</span>,
      },
    ]
    render(<DrawerLineItems columns={colsWithRender} rows={[{ pn: 'A', price: 100 }]} />)
    expect(screen.getByTestId('formatted-price')).toHaveTextContent('$100')
  })
})
