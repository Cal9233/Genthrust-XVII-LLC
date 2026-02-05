'use client'

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three-stdlib'
// NEW: Import the context
import { MouseHoverContext } from './index'

// Configuration
const TOTAL_PARTICLES = 15000
const BUILD_DURATION = 2.5
const DISPERSION_RADIUS = 60

// Mouse Interaction Config
const INFLUENCE_RADIUS = 8.0
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

// Helper to calculate surface area of a mesh geometry
function calculateSurfaceArea(geometry: THREE.BufferGeometry): number {
  let area = 0
  const position = geometry.attributes.position
  const index = geometry.index

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, index.getX(i))
      const b = new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 1))
      const c = new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 2))

      const edge1 = b.sub(a)
      const edge2 = c.sub(a)
      const cross = new THREE.Vector3().crossVectors(edge1, edge2)
      area += cross.length() * 0.5
    }
  }
  return area
}

// Area-Weighted Surface Sampling Hook
function useAircraftSurfacePoints(modelPath: string, totalDesiredParticles: number): THREE.Vector3[] {
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const gltf = useGLTF(modelPath)

  useEffect(() => {
    if (!gltf?.scene) return
    const meshes: { mesh: THREE.Mesh; area: number }[] = []
    let totalArea = 0
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.updateWorldMatrix(true, false)
        if (!child.geometry.index) child.geometry = child.geometry.toNonIndexed();
        const area = calculateSurfaceArea(child.geometry)
        meshes.push({ mesh: child, area })
        totalArea += area
      }
    })
    if (totalArea === 0 || meshes.length === 0) return
    const finalPoints: THREE.Vector3[] = []
    meshes.forEach(({ mesh, area }) => {
      const particleCount = Math.floor((area / totalArea) * totalDesiredParticles)
      if (particleCount === 0) return;
      const sampler = new MeshSurfaceSampler(mesh).build()
      const tempPosition = new THREE.Vector3()
      const matrixWorld = mesh.matrixWorld
      for (let i = 0; i < particleCount; i++) {
        sampler.sample(tempPosition)
        tempPosition.applyMatrix4(matrixWorld)
        finalPoints.push(tempPosition.clone())
      }
    })
    if (finalPoints.length > 0) {
      const box = new THREE.Box3()
      finalPoints.forEach(v => box.expandByPoint(v))
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 13 / maxDim
      finalPoints.forEach(v => {
        v.sub(center)
        v.multiplyScalar(scale)
      })
      setPoints(finalPoints)
    }
  }, [gltf, totalDesiredParticles])
  return points
}

useGLTF.preload('/models/aircraft.glb')

export default function AircraftParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const startTimeRef = useRef<number | null>(null)

  // NEW: Consume the context state
  const isHovering = React.useContext(MouseHoverContext)

  const { camera, viewport } = useThree()

  const vertices = useAircraftSurfacePoints('/models/aircraft.glb', TOTAL_PARTICLES)

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
    <group ref={groupRef} rotation={[Math.PI / 10, -Math.PI / 5, 0]}>
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