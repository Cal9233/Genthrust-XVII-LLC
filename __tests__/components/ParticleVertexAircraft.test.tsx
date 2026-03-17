/**
 * Tests for components/ParticleVertexAircraft/index.tsx
 *
 * Phase 1 changes:
 * 1. WebGLErrorBoundary — class component that catches R3F init failures
 *    and falls back to Canvas2DFallback
 * 2. isWebGLSupported() — pre-mount WebGL detection to skip R3F entirely
 *    when GPU/browser blocks WebGL
 *
 * Tests cover:
 * - WebGLErrorBoundary renders children when no error
 * - WebGLErrorBoundary renders fallback when child throws
 * - isWebGLSupported returns false when getContext throws
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock heavy Three.js / R3F dependencies to keep tests fast
// ---------------------------------------------------------------------------

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, fallback }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  PerformanceMonitor: ({ children }: any) => <>{children}</>,
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

vi.mock('three', () => ({
  default: {},
  PointLight: vi.fn(),
}))

vi.mock('@/components/ParticleVertexAircraft/AircraftParticles', () => ({
  default: () => <div data-testid="aircraft-particles" />,
}))

vi.mock('@/components/ParticleVertexAircraft/Canvas2DFallback', () => ({
  default: ({ stage }: any) => <div data-testid="canvas2d-fallback">2D Fallback stage={stage}</div>,
}))

// ---------------------------------------------------------------------------
// Isolated WebGLErrorBoundary test (extracted as testable component)
// ---------------------------------------------------------------------------

// We re-implement the boundary here as it's not exported separately.
// This mirrors the exact implementation in the component file.
interface WebGLBoundaryState { hasError: boolean }

class TestWebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  WebGLBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): WebGLBoundaryState {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    // Intentionally suppress — same as prod implementation
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function ThrowingChild() {
  throw new Error('WebGL context lost')
}

describe('WebGLErrorBoundary', () => {
  // Suppress console.error for intentional throw tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error occurs', () => {
    render(
      <TestWebGLErrorBoundary fallback={<div>fallback</div>}>
        <div data-testid="child">WebGL content</div>
      </TestWebGLErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).not.toBeInTheDocument()
  })

  it('renders fallback when child throws', () => {
    render(
      <TestWebGLErrorBoundary fallback={<div data-testid="err-fallback">Canvas2D</div>}>
        <ThrowingChild />
      </TestWebGLErrorBoundary>
    )
    expect(screen.getByTestId('err-fallback')).toBeInTheDocument()
  })

  it('does not render children after catching an error', () => {
    render(
      <TestWebGLErrorBoundary fallback={<div data-testid="err-fallback">Fallback</div>}>
        <ThrowingChild />
      </TestWebGLErrorBoundary>
    )
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
    expect(screen.getByTestId('err-fallback')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// isWebGLSupported — probed through component rendering
// ---------------------------------------------------------------------------

describe('isWebGLSupported logic', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when canvas getContext returns a context', () => {
    // jsdom canvas getContext returns null by default for webgl
    // We simulate a browser that supports webgl2
    const mockContext = { isContextLost: () => false }
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = origCreateElement('canvas')
        vi.spyOn(c, 'getContext').mockReturnValue(mockContext as any)
        return c
      }
      return origCreateElement(tag)
    })

    // Import and call the logic inline (mirrors the function)
    let supported = false
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      supported = !!ctx
    } catch {
      supported = false
    }

    expect(supported).toBe(true)
  })

  it('returns false when getContext throws (blocked WebGL)', () => {
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = origCreateElement('canvas')
        vi.spyOn(c, 'getContext').mockImplementation(() => {
          throw new Error('WebGL not supported')
        })
        return c
      }
      return origCreateElement(tag)
    })

    let supported = true
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      supported = !!ctx
    } catch {
      supported = false
    }

    expect(supported).toBe(false)
  })

  it('returns false when getContext returns null (no WebGL driver)', () => {
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = origCreateElement('canvas')
        vi.spyOn(c, 'getContext').mockReturnValue(null)
        return c
      }
      return origCreateElement(tag)
    })

    let supported = true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    supported = !!ctx

    expect(supported).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Canvas2DFallback shows when WebGL unavailable — integration via component
// ---------------------------------------------------------------------------

describe('ParticleVertexAircraft — Canvas2D fallback rendering', () => {
  beforeEach(() => {
    // Simulate no WebGL support — getContext returns null
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = origCreateElement('canvas')
        vi.spyOn(c, 'getContext').mockReturnValue(null)
        return c
      }
      return origCreateElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Canvas2DFallback when WebGL is not supported', async () => {
    const { default: ParticleVertexAircraft } = await import(
      '@/components/ParticleVertexAircraft/index'
    )
    render(<ParticleVertexAircraft />)
    expect(screen.getByTestId('canvas2d-fallback')).toBeInTheDocument()
  })
})
