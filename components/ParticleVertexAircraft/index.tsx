'use client'

import React, { Component, Suspense, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import AircraftParticles from './AircraftParticles'
import Canvas2DFallback from './Canvas2DFallback'
import type { IntroStage } from '../Hero/HeroIntro'

// ── WebGL Error Boundary ──────────────────────────────────────────────────────
// Catches WebGL init failures (blocked by browser, hardware, privacy settings)
// and transparently falls back to Canvas2D version.

interface WebGLBoundaryState {
  hasError: boolean
}

class WebGLErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  WebGLBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): WebGLBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // Silently swallow — canvas failure is non-fatal
    console.warn('[ParticleVertexAircraft] WebGL unavailable, using Canvas2D fallback.', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ── Detect WebGL support before attempting to mount Three.js Canvas ───────────
function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return true // SSR: optimistically assume yes
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return !!ctx
  } catch {
    return false
  }
}

// ── Loading spinner while R3F assets load ────────────────────────────────────
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <motion.div
        className="w-16 h-16 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// ── Three.js scene ────────────────────────────────────────────────────────────
function Scene({ stage, scrollVelocity, particleCount }: { stage: IntroStage; scrollVelocity: number; particleCount: number }) {
  const movingLight = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (movingLight.current) {
      movingLight.current.position.x = Math.sin(t * 1.5) * 20
      movingLight.current.position.z = Math.cos(t * 1.5) * 20
      movingLight.current.position.y = 8 + Math.sin(t * 2) * 5
    }
  })

  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.2} color="#ffffff" />
      {/* Key light from top-left */}
      <pointLight position={[-15, 20, -15]} intensity={1.5} color="#fff7ed" distance={100} />
      {/* Moving fill light for dynamic effect */}
      <pointLight ref={movingLight} position={[15, 10, 15]} intensity={1} color="#e0f2fe" distance={80} />
      {/* Rim light from behind */}
      <pointLight position={[0, -10, -20]} intensity={0.6} color="#020617" distance={60} />
      {/* Horizon blue accent light */}
      <pointLight position={[20, 0, 10]} intensity={0.4} color="#38B2AC" distance={50} />

      <Suspense fallback={null}>
        <AircraftParticles stage={stage} scrollVelocity={scrollVelocity} particleCount={particleCount} />
      </Suspense>

      {/* Fog to blend edges into deep space background */}
      <fog attach="fog" args={['#020617', 25, 80]} />
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
interface ParticleVertexAircraftProps {
  stage?: IntroStage
  scrollVelocity?: number
  initialParticleCount?: number
  initialDpr?: number
  maxDpr?: number
}

export default function ParticleVertexAircraft({
  stage = 'assembling',
  scrollVelocity = 0,
  initialParticleCount = 35000,
  initialDpr = 1.5,
  maxDpr = 2,
}: ParticleVertexAircraftProps) {
  const [dpr, setDpr] = useState(initialDpr)
  const [particleCount] = useState(initialParticleCount)
  // Eagerly check WebGL support on first render (client only)
  const [webGLOk] = useState<boolean>(() => isWebGLSupported())

  const handleIncline = useCallback(() => {
    setDpr((prev) => Math.min(prev + 0.5, maxDpr))
  }, [maxDpr])

  const handleDecline = useCallback(() => {
    setDpr((prev) => Math.max(prev - 0.5, 1))
  }, [])

  const handleFallback = useCallback(() => {
    setDpr(1)
  }, [])

  const canvas2DNode = (
    <Canvas2DFallback particleCount={300} />
  )

  // If WebGL is definitively unavailable, skip mounting the Canvas entirely
  if (!webGLOk) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0">
          {canvas2DNode}
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <WebGLErrorBoundary fallback={canvas2DNode}>
          <Suspense fallback={<LoadingFallback />}>
            <Canvas
              camera={{ position: [0, 0, 20], fov: 50 }}
              onCreated={({ gl }) => gl.setClearColor('#020617')}
              gl={{ antialias: true, alpha: false }}
              dpr={dpr}
            >
              <PerformanceMonitor
                onIncline={handleIncline}
                onDecline={handleDecline}
                flipflops={3}
                onFallback={handleFallback}
              >
                <Scene stage={stage} scrollVelocity={scrollVelocity} particleCount={particleCount} />
              </PerformanceMonitor>
            </Canvas>
          </Suspense>
        </WebGLErrorBoundary>
      </div>
    </div>
  )
}
