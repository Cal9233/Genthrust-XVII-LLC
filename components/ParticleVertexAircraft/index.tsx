'use client'

import React, { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import AircraftParticles from './AircraftParticles'

// Create a context to share hover state between DOM and Canvas
export const MouseHoverContext = React.createContext(false)

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Light spinner for contrast on dark background */}
      <motion.div
        className="w-16 h-16 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

function Scene() {
  const movingLight = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    movingLight.current.position.x = Math.sin(t * 2.0) * 25
    movingLight.current.position.z = Math.cos(t * 2.0) * 25
    movingLight.current.position.y = 10 + Math.sin(t * 3.0) * 10
  })

  return (
    <>
      {/* Ambient light for dark scene */}
      <ambientLight intensity={0.8} color="#ffffff" />
      {/* Warm key light */}
      <pointLight position={[-20, 20, -20]} intensity={2.5} color="#fff7ed" distance={100} />
      {/* Cool moving fill light */}
      <pointLight ref={movingLight} position={[15, 15, 15]} intensity={2} color="#e0f2fe" distance={80} />

      <Suspense fallback={null}>
        <AircraftParticles />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={true}
        autoRotateSpeed={0.5}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 1.8}
      />
      {/* Dark fog to blend into dark background */}
      <fog attach="fog" args={['#0f172a', 30, 90]} />
    </>
  )
}

export default function ParticleVertexAircraft() {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <div
      className="relative h-[600px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 shadow-lg"
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
    >
      <div className="absolute inset-0">
        <Suspense fallback={<LoadingFallback />}>
          <MouseHoverContext.Provider value={isHovering}>
            <Canvas
              camera={{ position: [0, 2, 18], fov: 50 }}
              onCreated={({ gl }) => gl.setClearColor('#0f172a')}
              gl={{ antialias: true, alpha: false }}
              dpr={[1, 2]}
            >
              <Scene />
            </Canvas>
          </MouseHoverContext.Provider>
        </Suspense>
      </div>

      {/* Removed dark gradient overlay for clean light look */}
    </div>
  )
}
