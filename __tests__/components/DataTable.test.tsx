/**
 * Tests for components/internal/DataTable.tsx
 * Tests sorting, empty state, loading skeleton, custom render functions,
 * onRowClick callback, and null value fallback.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DataTable } from '@/components/internal/DataTable'

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'value', label: 'Value', sortable: true, align: 'right' as const },
]

const sampleData = [
  { name: 'Charlie', status: 'OPEN', value: 30 },
  { name: 'Alice', status: 'CLOSED', value: 10 },
  { name: 'Bob', status: 'PENDING', value: 20 },
]

// Helper: get all <td> cells in column index `colIndex` from tbody rows
function getColumnCells(container: HTMLElement, colIndex: number): HTMLElement[] {
  const rows = container.querySelectorAll('tbody tr')
  return Array.from(rows)
    .map(row => row.querySelectorAll('td')[colIndex])
    .filter(Boolean) as HTMLElement[]
}

// ---------------------------------------------------------------------------
// Rendering basics
// ---------------------------------------------------------------------------

describe('DataTable basic rendering', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={[]} />)
    // Column labels are rendered as-is; CSS `uppercase` applies visual transform only
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
  })

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={sampleData} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('renders all rows (correct count)', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} />)
    // Each data row; the empty-state row should NOT appear when data is present
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('DataTable empty state', () => {
  it('shows default empty message when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('shows custom empty message when provided', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No repair orders found" />)
    expect(screen.getByText('No repair orders found')).toBeInTheDocument()
  })

  it('renders only 1 row when empty (the empty state row)', () => {
    const { container } = render(<DataTable columns={columns} data={[]} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('DataTable loading state', () => {
  it('shows loading skeleton when loading=true', () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('does not render table when loading', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} loading />)
    expect(container.querySelector('table')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('DataTable sorting', () => {
  it('sorts alphabetically ascending on first click', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} />)

    const nameHeader = screen.getByText('Name').closest('th')!
    fireEvent.click(nameHeader)

    const nameCells = getColumnCells(container, 0)
    expect(nameCells[0]).toHaveTextContent('Alice')
    expect(nameCells[1]).toHaveTextContent('Bob')
    expect(nameCells[2]).toHaveTextContent('Charlie')
  })

  it('sorts descending on second click of same column', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} />)

    const nameHeader = screen.getByText('Name').closest('th')!
    fireEvent.click(nameHeader) // asc
    fireEvent.click(nameHeader) // desc

    const nameCells = getColumnCells(container, 0)
    expect(nameCells[0]).toHaveTextContent('Charlie')
    expect(nameCells[1]).toHaveTextContent('Bob')
    expect(nameCells[2]).toHaveTextContent('Alice')
  })

  it('sorts numeric values correctly ascending', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} />)

    const valueHeader = screen.getByText('Value').closest('th')!
    fireEvent.click(valueHeader)

    const valueCells = getColumnCells(container, 2)
    expect(valueCells[0]).toHaveTextContent('10')
    expect(valueCells[1]).toHaveTextContent('20')
    expect(valueCells[2]).toHaveTextContent('30')
  })

  it('resets sort direction to asc when switching to a new column', () => {
    const { container } = render(<DataTable columns={columns} data={sampleData} />)

    const nameHeader = screen.getByText('Name').closest('th')!
    fireEvent.click(nameHeader) // asc
    fireEvent.click(nameHeader) // desc

    const statusHeader = screen.getByText('Status').closest('th')!
    fireEvent.click(statusHeader) // should reset to asc

    const statusCells = getColumnCells(container, 1)
    // CLOSED < OPEN < PENDING alphabetically
    expect(statusCells[0]).toHaveTextContent('CLOSED')
  })

  it('does not respond to clicks on non-sortable columns', () => {
    const noSortCols = [
      { key: 'name', label: 'Name', sortable: false },
    ]
    const data = [{ name: 'Charlie' }, { name: 'Alice' }]
    const { container } = render(<DataTable columns={noSortCols} data={data} />)

    const nameHeader = screen.getByText('Name').closest('th')!
    fireEvent.click(nameHeader)

    // Data should remain in original order
    const nameCells = getColumnCells(container, 0)
    expect(nameCells[0]).toHaveTextContent('Charlie')
    expect(nameCells[1]).toHaveTextContent('Alice')
  })
})

// ---------------------------------------------------------------------------
// Null value fallback
// ---------------------------------------------------------------------------

describe('DataTable null value fallback', () => {
  it('renders em-dash for null values', () => {
    const data = [{ name: 'Alice', status: null, value: 10 }]
    const { container } = render(<DataTable columns={columns} data={data as any} />)
    const statusCell = getColumnCells(container, 1)[0]
    expect(statusCell).toHaveTextContent('—')
  })

  it('renders em-dash for undefined values', () => {
    const data = [{ name: 'Bob', value: 5 }] // missing status
    const { container } = render(<DataTable columns={columns} data={data as any} />)
    const statusCell = getColumnCells(container, 1)[0]
    expect(statusCell).toHaveTextContent('—')
  })
})

// ---------------------------------------------------------------------------
// Custom render function
// ---------------------------------------------------------------------------

describe('DataTable custom render', () => {
  it('uses render function when provided', () => {
    const colsWithRender = [
      { key: 'name', label: 'Name' },
      {
        key: 'status',
        label: 'Status',
        render: (row: any) => <span data-testid="custom-cell">{row.status.toUpperCase()}</span>,
      },
    ]
    render(<DataTable columns={colsWithRender} data={[{ name: 'Alice', status: 'open' }]} />)
    expect(screen.getByTestId('custom-cell')).toHaveTextContent('OPEN')
  })
})

// ---------------------------------------------------------------------------
// Row click handler
// ---------------------------------------------------------------------------

describe('DataTable onRowClick', () => {
  it('calls onRowClick with the row data when a row is clicked', () => {
    const handleRowClick = vi.fn()
    render(<DataTable columns={columns} data={sampleData} onRowClick={handleRowClick} />)

    const aliceRow = screen.getByText('Alice').closest('tr')!
    fireEvent.click(aliceRow)

    expect(handleRowClick).toHaveBeenCalledOnce()
    expect(handleRowClick).toHaveBeenCalledWith({ name: 'Alice', status: 'CLOSED', value: 10 })
  })

  it('has cursor-pointer class on data rows when onRowClick is provided', () => {
    const { container } = render(
      <DataTable columns={columns} data={sampleData} onRowClick={() => {}} />
    )
    const firstDataRow = container.querySelector('tbody tr') as HTMLElement
    expect(firstDataRow.className).toContain('cursor-pointer')
  })
})
