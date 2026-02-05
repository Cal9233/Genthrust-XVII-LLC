'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'

interface DataGridProps {
  size?: number
  divisions?: number
}

export default function DataGrid({ size = 60, divisions = 30 }: DataGridProps) {
  const groupRef = useRef<THREE.Group>(null!)

  // Create simple grid geometry
  const geometry = useMemo(() => {
    const points: number[] = []
    const step = size / divisions
    const halfSize = size / 2

    for (let i = 0; i <= divisions; i++) {
      const pos = -halfSize + i * step

      // Lines parallel to Z axis
      points.push(pos, 0, -halfSize)
      points.push(pos, 0, halfSize)

      // Lines parallel to X axis
      points.push(-halfSize, 0, pos)
      points.push(halfSize, 0, pos)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [size, divisions])

  return (
    <group ref={groupRef} position={[0, -12, 0]}>
      {/* Simple subtle floor grid */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color="#0a1525"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}
