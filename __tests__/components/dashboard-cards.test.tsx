/**
 * Tests for components/internal/cards/*.tsx
 * Tests each dashboard card: AutomationCard, BotHealthCard, ClientsCard,
 * ERPSyncCard, InventoryCard, QuotesCard.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import AutomationCard from '@/components/internal/cards/AutomationCard'
import BotHealthCard from '@/components/internal/cards/BotHealthCard'
import ClientsCard from '@/components/internal/cards/ClientsCard'
import ERPSyncCard from '@/components/internal/cards/ERPSyncCard'
import InventoryCard from '@/components/internal/cards/InventoryCard'
import QuotesCard from '@/components/internal/cards/QuotesCard'

// ---------------------------------------------------------------------------
// AutomationCard
// ---------------------------------------------------------------------------

describe('AutomationCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(<AutomationCard dueSoon={0} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('does not render count when loading', () => {
    render(<AutomationCard dueSoon={3} loading />)
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })
})

describe('AutomationCard rendering', () => {
  it('renders the dueSoon count', () => {
    render(<AutomationCard dueSoon={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders "Clear" status when dueSoon is 0', () => {
    render(<AutomationCard dueSoon={0} />)
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('renders "Monitor" status when dueSoon is 1-5', () => {
    render(<AutomationCard dueSoon={3} />)
    expect(screen.getByText('Monitor')).toBeInTheDocument()
  })

  it('renders "Action Needed" status when dueSoon > 5', () => {
    render(<AutomationCard dueSoon={6} />)
    expect(screen.getByText('Action Needed')).toBeInTheDocument()
  })

  it('renders green dot when dueSoon is 0', () => {
    const { container } = render(<AutomationCard dueSoon={0} />)
    // The status dot is a small rounded-full span — select via class pattern
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-green-400')
  })

  it('renders yellow dot when dueSoon is 1-5', () => {
    const { container } = render(<AutomationCard dueSoon={2} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-yellow-400')
  })

  it('renders red dot when dueSoon > 5', () => {
    const { container } = render(<AutomationCard dueSoon={10} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-red-400')
  })

  it('renders the section label text', () => {
    render(<AutomationCard dueSoon={0} />)
    expect(screen.getByText('NET-30 payment monitoring')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// BotHealthCard
// ---------------------------------------------------------------------------

describe('BotHealthCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(<BotHealthCard running={0} total={0} stopped={0} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('BotHealthCard rendering', () => {
  it('renders running count', () => {
    render(<BotHealthCard running={3} total={5} stopped={2} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders total active label', () => {
    render(<BotHealthCard running={3} total={5} stopped={2} />)
    expect(screen.getByText(/\/ 5 active/)).toBeInTheDocument()
  })

  it('renders stopped count', () => {
    render(<BotHealthCard running={3} total={5} stopped={2} />)
    expect(screen.getByText(/2 stopped/)).toBeInTheDocument()
  })

  it('shows "All Running" when running equals total', () => {
    render(<BotHealthCard running={4} total={4} stopped={0} />)
    expect(screen.getByText('All Running')).toBeInTheDocument()
  })

  it('shows "All Stopped" when running is 0', () => {
    render(<BotHealthCard running={0} total={3} stopped={3} />)
    expect(screen.getByText('All Stopped')).toBeInTheDocument()
  })

  it('shows "Degraded" when some bots are stopped', () => {
    render(<BotHealthCard running={2} total={5} stopped={3} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('shows "Unknown" when total is 0', () => {
    render(<BotHealthCard running={0} total={0} stopped={0} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('uses green dot when all running', () => {
    const { container } = render(<BotHealthCard running={2} total={2} stopped={0} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-green-400')
  })

  it('uses red dot when all stopped', () => {
    const { container } = render(<BotHealthCard running={0} total={2} stopped={2} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-red-400')
  })
})

// ---------------------------------------------------------------------------
// ClientsCard
// ---------------------------------------------------------------------------

describe('ClientsCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(<ClientsCard total={0} active={0} pending={0} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('ClientsCard rendering', () => {
  it('renders active count', () => {
    render(<ClientsCard total={10} active={8} pending={2} />)
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders total in active label', () => {
    render(<ClientsCard total={10} active={8} pending={2} />)
    expect(screen.getByText(/\/ 10 active/)).toBeInTheDocument()
  })

  it('shows pending count in status when pending > 0', () => {
    render(<ClientsCard total={10} active={8} pending={2} />)
    expect(screen.getByText('2 pending')).toBeInTheDocument()
  })

  it('shows "All Active" when no pending clients', () => {
    render(<ClientsCard total={5} active={5} pending={0} />)
    expect(screen.getByText('All Active')).toBeInTheDocument()
  })

  it('shows awaiting badge when pending > 0', () => {
    render(<ClientsCard total={10} active={8} pending={2} />)
    expect(screen.getByText(/2 awaiting/)).toBeInTheDocument()
  })

  it('does not show awaiting badge when pending is 0', () => {
    render(<ClientsCard total={5} active={5} pending={0} />)
    expect(screen.queryByText(/awaiting/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ERPSyncCard
// ---------------------------------------------------------------------------

describe('ERPSyncCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(
      <ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={0} loading />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('ERPSyncCard rendering', () => {
  it('renders RO count', () => {
    render(<ERPSyncCard activeROs={12} activeSOs={5} openInvoices={3} openBalance={10000} />)
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders SO count', () => {
    render(<ERPSyncCard activeROs={12} activeSOs={5} openInvoices={3} openBalance={10000} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders invoice count', () => {
    render(<ERPSyncCard activeROs={12} activeSOs={5} openInvoices={3} openBalance={10000} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('formats balance under $1000 as dollars', () => {
    render(<ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={500} />)
    expect(screen.getByText('$500')).toBeInTheDocument()
  })

  it('formats balance in thousands as $Xk', () => {
    render(<ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={25000} />)
    expect(screen.getByText('$25k')).toBeInTheDocument()
  })

  it('formats balance in millions as $X.XM', () => {
    render(<ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={1500000} />)
    expect(screen.getByText('$1.5M')).toBeInTheDocument()
  })

  it('shows "Healthy" status when balance <= 50000', () => {
    render(<ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={50000} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('shows "Attention" status when balance > 50000', () => {
    render(<ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={50001} />)
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('uses green dot when balance <= 50000', () => {
    const { container } = render(
      <ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={10000} />
    )
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-green-400')
  })

  it('uses yellow dot when balance > 50000', () => {
    const { container } = render(
      <ERPSyncCard activeROs={0} activeSOs={0} openInvoices={0} openBalance={100000} />
    )
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-yellow-400')
  })
})

// ---------------------------------------------------------------------------
// InventoryCard
// ---------------------------------------------------------------------------

describe('InventoryCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(<InventoryCard totalSkus={0} activeAlarms={0} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('InventoryCard rendering', () => {
  it('renders totalSkus count', () => {
    render(<InventoryCard totalSkus={1234} activeAlarms={0} />)
    // toLocaleString may format as 1,234
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('renders activeAlarms count', () => {
    render(<InventoryCard totalSkus={100} activeAlarms={5} />)
    expect(screen.getByText(/5 unack'd alarms/)).toBeInTheDocument()
  })

  it('shows "No Alerts" when activeAlarms is 0', () => {
    render(<InventoryCard totalSkus={100} activeAlarms={0} />)
    expect(screen.getByText('No Alerts')).toBeInTheDocument()
  })

  it('shows alert count in status when activeAlarms is 1-10', () => {
    render(<InventoryCard totalSkus={100} activeAlarms={5} />)
    expect(screen.getByText('5 alerts')).toBeInTheDocument()
  })

  it('shows "High Alerts" when activeAlarms > 10', () => {
    render(<InventoryCard totalSkus={100} activeAlarms={11} />)
    expect(screen.getByText('High Alerts')).toBeInTheDocument()
  })

  it('uses green dot when no alarms', () => {
    const { container } = render(<InventoryCard totalSkus={100} activeAlarms={0} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-green-400')
  })

  it('uses yellow dot when 1-10 alarms', () => {
    const { container } = render(<InventoryCard totalSkus={100} activeAlarms={5} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-yellow-400')
  })

  it('uses red dot when > 10 alarms', () => {
    const { container } = render(<InventoryCard totalSkus={100} activeAlarms={15} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-red-400')
  })
})

// ---------------------------------------------------------------------------
// QuotesCard
// ---------------------------------------------------------------------------

describe('QuotesCard loading state', () => {
  it('renders animate-pulse skeleton when loading', () => {
    const { container } = render(<QuotesCard total={0} pending={0} processed={0} loading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('QuotesCard rendering', () => {
  it('renders pending count as the main metric', () => {
    render(<QuotesCard total={20} pending={5} processed={15} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders total in sub-label', () => {
    render(<QuotesCard total={20} pending={5} processed={15} />)
    expect(screen.getByText(/pending \/ 20 total/)).toBeInTheDocument()
  })

  it('renders processed count', () => {
    render(<QuotesCard total={20} pending={5} processed={15} />)
    expect(screen.getByText(/15 processed/)).toBeInTheDocument()
  })

  it('shows "Queue clear" when pending is 0', () => {
    render(<QuotesCard total={10} pending={0} processed={10} />)
    expect(screen.getByText('Queue clear')).toBeInTheDocument()
  })

  it('shows pending count in status when pending > 0', () => {
    render(<QuotesCard total={10} pending={3} processed={7} />)
    expect(screen.getByText('3 pending')).toBeInTheDocument()
  })

  it('uses green dot when pending is 0', () => {
    const { container } = render(<QuotesCard total={5} pending={0} processed={5} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-green-400')
  })

  it('uses yellow dot when pending is 1-10', () => {
    const { container } = render(<QuotesCard total={15} pending={5} processed={10} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-yellow-400')
  })

  it('uses red dot when pending > 10', () => {
    const { container } = render(<QuotesCard total={20} pending={11} processed={9} />)
    const dot = container.querySelector('.w-2.h-2.rounded-full')
    expect(dot?.className).toContain('bg-red-400')
  })
})
