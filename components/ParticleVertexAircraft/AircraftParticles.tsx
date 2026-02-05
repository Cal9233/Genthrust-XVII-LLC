'use client'

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MouseHoverContext } from './index'

// Configuration
const TOTAL_PARTICLES = 12000
const BUILD_DURATION = 2.5
const DISPERSION_RADIUS = 40

// Mouse Interaction Config
const INFLUENCE_RADIUS = 6.0
const REPULSION_STRENGTH = 3.0

// Smooth ease-out function
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

interface ParticleData {
  targetPosition: THREE.Vector3
  startPosition: THREE.Vector3
  currentOffset: THREE.Vector3
}

// Logo Image Sampling Hook - samples points from non-transparent pixels in PNG
function useLogoPoints(imagePath: string, totalParticles: number, scale: number): THREE.Vector3[] {
  const [points, setPoints] = useState<THREE.Vector3[]>([])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Collect positions of non-transparent pixels
      // Only include upper ~65% of image (diamond area, exclude text)
      const maxY = Math.floor(canvas.height * 0.65)
      const validPixels: { x: number; y: number }[] = []

      for (let y = 0; y < maxY; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const alpha = data[idx + 3]
          // Only include pixels with sufficient opacity
          if (alpha > 50) {
            validPixels.push({ x, y })
          }
        }
      }

      if (validPixels.length === 0) return

      // Randomly sample from valid pixels
      const sampledPoints: THREE.Vector3[] = []
      for (let i = 0; i < totalParticles; i++) {
        const pixel = validPixels[Math.floor(Math.random() * validPixels.length)]

        // Convert pixel coords to centered 3D coords
        // Center the coordinates and flip Y axis
        const px = (pixel.x - canvas.width / 2) * scale
        const py = (canvas.height / 2 - pixel.y) * scale // Flip Y

        // Add slight Z randomness for depth
        const pz = (Math.random() - 0.5) * 0.5

        sampledPoints.push(new THREE.Vector3(px, py, pz))
      }

      // Center and normalize the points
      if (sampledPoints.length > 0) {
        const box = new THREE.Box3()
        sampledPoints.forEach(v => box.expandByPoint(v))
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const normalizeScale = 13 / maxDim

        sampledPoints.forEach(v => {
          v.sub(center)
          v.multiplyScalar(normalizeScale)
        })

        setPoints(sampledPoints)
      }
    }

    img.src = imagePath
  }, [imagePath, totalParticles, scale])

  return points
}

export default function AircraftParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const startTimeRef = useRef<number | null>(null)

  // Consume the context state for mouse hover
  const isHovering = React.useContext(MouseHoverContext)

  const { camera, viewport } = useThree()

  // Sample points from logo PNG (diamond icon only)
  const vertices = useLogoPoints('/GenLogoTab.png', TOTAL_PARTICLES, 0.02)

  const particles = useMemo((): ParticleData[] => {
    if (vertices.length === 0) return []
    return vertices.map((targetPos) => ({
      targetPosition: targetPos.clone(),
      startPosition: new THREE.Vector3(
        (Math.random() - 0.5) * DISPERSION_RADIUS * 2,
        (Math.random() - 0.5) * DISPERSION_RADIUS * 1.5,
        (Math.random() - 0.5) * DISPERSION_RADIUS * 1.5
      ),
      currentOffset: new THREE.Vector3(0, 0, 0),
    }))
  }, [vertices])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const basePosition = useMemo(() => new THREE.Vector3(), [])
  const finalPosition = useMemo(() => new THREE.Vector3(), [])
  const mousePosition = useMemo(() => new THREE.Vector3(), [])
  const localMousePosition = useMemo(() => new THREE.Vector3(), [])
  const repulsionVector = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current || particles.length === 0) return

    const elapsed = state.clock.elapsedTime
    if (startTimeRef.current === null) startTimeRef.current = elapsed + 0.5

    const timeSinceStart = Math.max(0, elapsed - startTimeRef.current)
    const buildProgress = Math.min(1, timeSinceStart / BUILD_DURATION)
    const t = easeOutCubic(buildProgress)

    // 1. Calculate World Mouse Position
    const distance = camera.position.z
    const perspCamera = camera as THREE.PerspectiveCamera
    const vFov = (perspCamera.fov * Math.PI) / 180
    const height = 2 * Math.tan(vFov / 2) * distance
    const width = height * viewport.aspect
    mousePosition.set(
      (state.pointer.x * width) / 2,
      (state.pointer.y * height) / 2,
      0
    )

    // 2. Convert World Mouse Pos -> Local Group Space
    localMousePosition.copy(mousePosition)
    groupRef.current.worldToLocal(localMousePosition)

    particles.forEach((particle, i) => {
      basePosition.lerpVectors(particle.startPosition, particle.targetPosition, t)

      if (buildProgress >= 1) {
        // Reset repulsion vector
        repulsionVector.set(0, 0, 0)

        // NEW: Only calculate repulsion if hovering
        if (isHovering) {
          const dist = basePosition.distanceTo(localMousePosition)
          if (dist < INFLUENCE_RADIUS) {
            const force = (1 - dist / INFLUENCE_RADIUS) * REPULSION_STRENGTH
            repulsionVector.subVectors(basePosition, localMousePosition).normalize().multiplyScalar(force)
          }
        }

        // Smoothly lerp towards the repulsion vector (which is 0,0,0 if not hovering)
        particle.currentOffset.lerp(repulsionVector, 0.02)
      }

      finalPosition.addVectors(basePosition, particle.currentOffset)
      dummy.position.copy(finalPosition)

      const scale = t
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (particles.length === 0) return null

  return (
    <group ref={groupRef} rotation={[0, 0, 0]}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        {/* Metallic blue material for bright daylight environment */}
        <meshStandardMaterial
          color="#0369a1"
          roughness={0.3}
          metalness={0.8}
          transparent={true}
          opacity={0.9}
        />
      </instancedMesh>
    </group>
  )
}