'use client'

import React, { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import AircraftParticles from './AircraftParticles'
import type { IntroStage } from '../Hero/HeroIntro'
import { a } from 'framer-motion/client'

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="w-16 h-16 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

function Scene({ stage, scrollVelocity }: { stage: IntroStage; scrollVelocity: number }) {
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
      {/* Ambient light for base illumination - reduced for darker background */}
      <ambientLight intensity={0.2} color="#ffffff" />
      {/* Key light from top-left */}
      <pointLight position={[-15, 20, -15]} intensity={1.5} color="#fff7ed" distance={100} />
      {/* Moving fill light for dynamic effect */}
      <pointLight ref={movingLight} position={[15, 10, 15]} intensity={1} color="#e0f2fe" distance={80} />
      {/* Rim light from behind - adjusted for deep space background */}
      <pointLight position={[0, -10, -20]} intensity={0.6} color="#020617" distance={60} />
      {/* Horizon blue accent light */}
      <pointLight position={[20, 0, 10]} intensity={0.4} color="#38B2AC" distance={50} />

      <Suspense fallback={null}>
        <AircraftParticles stage={stage} scrollVelocity={scrollVelocity} />
      </Suspense>

      {/* Fog to blend edges into deep space background */}
      <fog attach="fog" args={['#020617', 25, 80]} />
    </>
  )
}

interface ParticleVertexAircraftProps {
  stage?: IntroStage
  scrollVelocity?: number
}

export default function ParticleVertexAircraft({ stage = 'assembling', scrollVelocity = 0 }: ParticleVertexAircraftProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{ position: [0, 0, 20], fov: 50 }}
            onCreated={({ gl }) => gl.setClearColor('#020617')}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
          >
            <Scene stage={stage} scrollVelocity={scrollVelocity} />
          </Canvas>
        </Suspense>
      </div>
    </div>
  )
}