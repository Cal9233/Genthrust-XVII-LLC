/**
 * Tests for public section components:
 * ContactSection, FeaturedInventory, ServicesBento, StatsBar
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    article: ({ children, ...props }: any) => <article {...props}>{children}</article>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useInView: () => true,
}))

import { ContactSection } from '@/components/sections/ContactSection'
import { ServicesBento } from '@/components/sections/ServicesBento'
import { StatsBar } from '@/components/sections/StatsBar'

// ===========================================================================
// ContactSection
// ===========================================================================

describe('ContactSection rendering', () => {
  it('renders the Contact Us heading', () => {
    render(<ContactSection />)
    expect(screen.getByText('Contact Us')).toBeInTheDocument()
  })

  it('renders the Request a Quote form heading', () => {
    render(<ContactSection />)
    expect(screen.getByText('Request a Quote')).toBeInTheDocument()
  })

  it('renders first name field', () => {
    render(<ContactSection />)
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument()
  })

  it('renders last name field', () => {
    render(<ContactSection />)
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument()
  })

  it('renders email field', () => {
    render(<ContactSection />)
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
  })

  it('renders part number field', () => {
    render(<ContactSection />)
    expect(screen.getByPlaceholderText('Part Name or Number')).toBeInTheDocument()
  })

  it('renders message textarea', () => {
    render(<ContactSection />)
    expect(screen.getByPlaceholderText('Message')).toBeInTheDocument()
  })

  it('renders Submit Request button', () => {
    render(<ContactSection />)
    expect(screen.getByRole('button', { name: /submit request/i })).toBeInTheDocument()
  })

  it('renders contact info cards (Call Us, Email Us, Business Hours, Visit Us)', () => {
    render(<ContactSection />)
    expect(screen.getByText('Call Us')).toBeInTheDocument()
    expect(screen.getByText('Email Us')).toBeInTheDocument()
    expect(screen.getByText('Business Hours')).toBeInTheDocument()
    expect(screen.getByText('Visit Us')).toBeInTheDocument()
  })

  it('renders team contact names', () => {
    render(<ContactSection />)
    expect(screen.getByText(/Jose Malagon/)).toBeInTheDocument()
    expect(screen.getByText(/Sandra Gallagher/)).toBeInTheDocument()
  })

  it('renders the sales email', () => {
    render(<ContactSection />)
    expect(screen.getAllByText('sales@genthrust.net').length).toBeGreaterThan(0)
  })
})

describe('ContactSection form behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('updates input values as user types', () => {
    render(<ContactSection />)
    const firstNameInput = screen.getByPlaceholderText('First Name')
    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    expect(firstNameInput).toHaveValue('John')
  })

  it('shows success state after successful form submission', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as any)))

    render(<ContactSection />)
    fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'John' } })
    fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'j@test.com' } })
    fireEvent.submit(screen.getByRole('button', { name: /submit request/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Request submitted!')).toBeInTheDocument()
    })
  })

  it('shows error message when form submission fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    } as any)))

    render(<ContactSection />)
    fireEvent.submit(screen.getByRole('button', { name: /submit request/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  it('shows "Submit another request" link after success', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as any)))

    render(<ContactSection />)
    fireEvent.submit(screen.getByRole('button', { name: /submit request/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/submit another request/i)).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// ServicesBento
// ===========================================================================

describe('ServicesBento rendering', () => {
  it('renders the Our Services heading', () => {
    render(<ServicesBento />)
    expect(screen.getByText('Services')).toBeInTheDocument()
  })

  it('renders the "What We Offer" section label', () => {
    render(<ServicesBento />)
    expect(screen.getByText('What We Offer')).toBeInTheDocument()
  })

  it('renders Parts Sourcing service card', () => {
    render(<ServicesBento />)
    expect(screen.getByText('Parts Sourcing')).toBeInTheDocument()
  })

  it('renders Component Repair service card', () => {
    render(<ServicesBento />)
    expect(screen.getByText('Component Repair')).toBeInTheDocument()
  })

  it('renders Parts Sales service card', () => {
    render(<ServicesBento />)
    expect(screen.getByText('Parts Sales')).toBeInTheDocument()
  })

  it('renders AOG Support service card', () => {
    render(<ServicesBento />)
    expect(screen.getByText('AOG Support')).toBeInTheDocument()
  })

  it('renders service descriptions', () => {
    render(<ServicesBento />)
    expect(screen.getByText(/global network of certified suppliers/i)).toBeInTheDocument()
  })
})

// ===========================================================================
// StatsBar
// ===========================================================================

describe('StatsBar rendering', () => {
  it('renders the Years Experience stat', () => {
    render(<StatsBar />)
    expect(screen.getByText('Years Experience')).toBeInTheDocument()
  })

  it('renders the 25+ value', () => {
    render(<StatsBar />)
    expect(screen.getByText('25+')).toBeInTheDocument()
  })

  it('renders the Global Partners stat', () => {
    render(<StatsBar />)
    expect(screen.getByText('Global Partners')).toBeInTheDocument()
  })

  it('renders the 500+ value', () => {
    render(<StatsBar />)
    expect(screen.getByText('500+')).toBeInTheDocument()
  })

  it('renders the Parts Delivered stat', () => {
    render(<StatsBar />)
    expect(screen.getByText('Parts Delivered')).toBeInTheDocument()
  })

  it('renders the On-Time Delivery stat', () => {
    render(<StatsBar />)
    expect(screen.getByText('On-Time Delivery')).toBeInTheDocument()
  })

  it('renders all 4 stat items', () => {
    render(<StatsBar />)
    // STATS has 4 entries
    expect(screen.getByText('10K+')).toBeInTheDocument()
    expect(screen.getByText('99%')).toBeInTheDocument()
  })
})
