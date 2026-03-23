/**
 * Tests for UI primitive components:
 * Button, Modal, Dialog, Spinner, SkeletonLoader, SearchInput, Toggle,
 * ProgressBar, ProgressRing
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useInView: () => true,
  HTMLMotionProps: {},
}))

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { SkeletonLoader, SkeletonGroup } from '@/components/ui/SkeletonLoader'
import { SearchInput } from '@/components/ui/SearchInput'
import { Toggle } from '@/components/ui/Toggle'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ProgressRing } from '@/components/ui/ProgressRing'

// ===========================================================================
// Button
// ===========================================================================

describe('Button rendering', () => {
  it('renders children text', () => {
    render(<Button>Click Me</Button>)
    expect(screen.getByText('Click Me')).toBeInTheDocument()
  })

  it('renders as a button element', () => {
    render(<Button>Submit</Button>)
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('applies primary variant class by default', () => {
    const { container } = render(<Button>Primary</Button>)
    expect(container.querySelector('button')?.className).toContain('bg-electric-blue')
  })

  it('applies outline variant class', () => {
    const { container } = render(<Button variant="outline">Outline</Button>)
    expect(container.querySelector('button')?.className).toContain('border-electric-blue')
  })

  it('applies outline-red variant class', () => {
    const { container } = render(<Button variant="outline-red">Danger</Button>)
    expect(container.querySelector('button')?.className).toContain('border-crimson')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>No Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders icon in left position by default', () => {
    const icon = <span data-testid="icon">*</span>
    render(<Button icon={icon}>Text</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders icon in right position when specified', () => {
    const icon = <span data-testid="right-icon">*</span>
    render(<Button icon={icon} iconPosition="right">Text</Button>)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })
})

// ===========================================================================
// Modal
// ===========================================================================

describe('Modal rendering', () => {
  it('renders children when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Hidden content</p>
      </Modal>
    )
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Confirm Action">
        <p>Are you sure?</p>
      </Modal>
    )
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Content</p>
      </Modal>
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not show close button when closeOnBackdropClick is false', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} closeOnBackdropClick={false}>
        <p>Persistent modal</p>
      </Modal>
    )
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Dialog
// ===========================================================================

describe('Dialog rendering', () => {
  it('renders title', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} title="Delete Record">
        <p>Are you sure?</p>
      </Dialog>
    )
    expect(screen.getByText('Delete Record')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} title="Confirm">
        <p data-testid="dialog-body">Dialog body text</p>
      </Dialog>
    )
    expect(screen.getByTestId('dialog-body')).toBeInTheDocument()
  })

  it('renders Confirm and Cancel buttons by default', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Dialog>
    )
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders custom confirm/cancel text', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} title="Test"
        confirmText="Delete" cancelText="Go Back"
      >
        <p>Content</p>
      </Dialog>
    )
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Go Back')).toBeInTheDocument()
  })

  it('calls onConfirm and onClose when Confirm is clicked', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <Dialog isOpen={true} onClose={onClose} onConfirm={onConfirm} title="Test">
        <p>Content</p>
      </Dialog>
    )
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onCancel and onClose when Cancel is clicked', () => {
    const onCancel = vi.fn()
    const onClose = vi.fn()
    render(
      <Dialog isOpen={true} onClose={onClose} onCancel={onCancel} title="Test">
        <p>Content</p>
      </Dialog>
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not render when closed', () => {
    render(
      <Dialog isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>Should not show</p>
      </Dialog>
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Spinner
// ===========================================================================

describe('Spinner rendering', () => {
  it('renders a spinner element with default variant', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies md size class by default', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.w-8')).toBeInTheDocument()
  })

  it('applies sm size class when size=sm', () => {
    const { container } = render(<Spinner size="sm" />)
    expect(container.querySelector('.w-4')).toBeInTheDocument()
  })

  it('applies lg size class when size=lg', () => {
    const { container } = render(<Spinner size="lg" />)
    expect(container.querySelector('.w-12')).toBeInTheDocument()
  })

  it('renders dots variant as multiple child elements', () => {
    const { container } = render(<Spinner variant="dots" />)
    // Dots variant renders a div with 3 animated children
    const children = container.firstElementChild?.children
    expect(children?.length).toBe(3)
  })

  it('applies custom className', () => {
    const { container } = render(<Spinner className="my-custom-class" />)
    expect(container.firstElementChild?.className).toContain('my-custom-class')
  })
})

// ===========================================================================
// SkeletonLoader
// ===========================================================================

describe('SkeletonLoader rendering', () => {
  it('renders a skeleton element', () => {
    const { container } = render(<SkeletonLoader />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies base bg-slate-200 class', () => {
    const { container } = render(<SkeletonLoader />)
    expect(container.querySelector('.bg-slate-200')).toBeInTheDocument()
  })

  it('applies text variant class', () => {
    const { container } = render(<SkeletonLoader variant="text" />)
    expect(container.firstElementChild?.className).toContain('h-4')
  })

  it('applies circular variant class', () => {
    const { container } = render(<SkeletonLoader variant="circular" />)
    expect(container.firstElementChild?.className).toContain('rounded-full')
  })

  it('applies custom width and height via style', () => {
    const { container } = render(<SkeletonLoader width={200} height={100} />)
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('100px')
  })

  it('applies custom className', () => {
    const { container } = render(<SkeletonLoader className="custom-skel" />)
    expect(container.firstElementChild?.className).toContain('custom-skel')
  })
})

describe('SkeletonGroup rendering', () => {
  it('renders the default count of 3 skeletons', () => {
    const { container } = render(<SkeletonGroup />)
    expect(container.querySelectorAll('.bg-slate-200').length).toBe(3)
  })

  it('renders the specified count of skeletons', () => {
    const { container } = render(<SkeletonGroup count={5} />)
    expect(container.querySelectorAll('.bg-slate-200').length).toBe(5)
  })
})

// ===========================================================================
// SearchInput
// ===========================================================================

describe('SearchInput rendering', () => {
  it('renders a text input', () => {
    render(<SearchInput />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<SearchInput placeholder="Search parts..." />)
    expect(screen.getByPlaceholderText('Search parts...')).toBeInTheDocument()
  })

  it('calls onChange handler when input changes', () => {
    const onChange = vi.fn()
    render(<SearchInput onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'CFM56' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('propagates the input value', () => {
    render(<SearchInput defaultValue="test value" />)
    expect(screen.getByRole('textbox')).toHaveValue('test value')
  })
})

// ===========================================================================
// Toggle
// ===========================================================================

describe('Toggle rendering', () => {
  it('renders a switch button', () => {
    render(<Toggle checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('has aria-checked=false when unchecked', () => {
    render(<Toggle checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('has aria-checked=true when checked', () => {
    render(<Toggle checked={true} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with true when toggled from false', () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange with false when toggled from true', () => {
    const onChange = vi.fn()
    render(<Toggle checked={true} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders label text when provided', () => {
    render(<Toggle checked={false} onChange={vi.fn()} label="Enable notifications" />)
    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
  })

  it('applies opacity-50 class when disabled', () => {
    const { container } = render(<Toggle checked={false} onChange={vi.fn()} disabled />)
    expect(container.querySelector('.opacity-50')).toBeInTheDocument()
  })
})

// ===========================================================================
// ProgressBar
// ===========================================================================

describe('ProgressBar rendering', () => {
  it('renders a progress bar when show=true', () => {
    const { container } = render(<ProgressBar progress={50} show={true} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('does not render when show=false', () => {
    const { container } = render(<ProgressBar progress={50} show={false} />)
    // AnimatePresence removes the element when show=false
    expect(container.firstChild).not.toBeInTheDocument()
  })

  it('applies default variant (bg-electric-blue) to progress fill', () => {
    const { container } = render(<ProgressBar progress={75} show={true} />)
    const fill = container.querySelector('.bg-electric-blue')
    expect(fill).toBeInTheDocument()
  })

  it('applies success variant to progress fill', () => {
    const { container } = render(<ProgressBar progress={75} show={true} variant="success" />)
    const fill = container.querySelector('.bg-green-500')
    expect(fill).toBeInTheDocument()
  })

  it('applies warning variant to progress fill', () => {
    const { container } = render(<ProgressBar progress={75} show={true} variant="warning" />)
    const fill = container.querySelector('.bg-yellow-500')
    expect(fill).toBeInTheDocument()
  })

  it('applies error variant to progress fill', () => {
    const { container } = render(<ProgressBar progress={75} show={true} variant="error" />)
    const fill = container.querySelector('.bg-crimson')
    expect(fill).toBeInTheDocument()
  })
})

// ===========================================================================
// ProgressRing
// ===========================================================================

describe('ProgressRing rendering', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ProgressRing progress={60} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders two circle elements (background + progress)', () => {
    const { container } = render(<ProgressRing progress={60} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
  })

  it('renders percentage label when showLabel=true', () => {
    render(<ProgressRing progress={75} showLabel={true} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders custom label text when provided', () => {
    render(<ProgressRing progress={40} label="40 hrs" />)
    expect(screen.getByText('40 hrs')).toBeInTheDocument()
  })

  it('does not render label when showLabel is false and no label prop', () => {
    render(<ProgressRing progress={50} />)
    expect(screen.queryByText('50%')).not.toBeInTheDocument()
  })

  it('renders SVG with correct size', () => {
    const { container } = render(<ProgressRing progress={50} size={120} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '120')
    expect(svg).toHaveAttribute('height', '120')
  })

  it('rounds percentage label to nearest integer', () => {
    render(<ProgressRing progress={33.7} showLabel={true} />)
    expect(screen.getByText('34%')).toBeInTheDocument()
  })
})
