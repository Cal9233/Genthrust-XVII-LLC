'use client'

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { IntroStage } from '../Hero/HeroIntro'

// CONFIGURATION
const TOTAL_PARTICLES = 35000
const BUILD_DURATION = 1.8
const DISPERSION_RADIUS = 35

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Shader for particle animation with velocity streaks
const vertexShader = `
  attribute vec3 instancePosition;
  attribute vec3 targetPosition;
  attribute vec3 color;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vStretch;

  uniform float uProgress;
  uniform float uTime;
  uniform float uScrollVelocity;

  void main() {
    vColor = color;

    float smoothProgress = pow(uProgress, 2.0);
    vec3 pos = mix(instancePosition, targetPosition, smoothProgress);

    // Floating effect during assembly
    float floatAmount = (1.0 - smoothProgress) * 0.4;
    pos.y += sin(uTime * 2.0 + instancePosition.x * 5.0) * floatAmount;
    pos.x += cos(uTime * 1.5 + instancePosition.y * 3.0) * floatAmount * 0.3;

    // Velocity streaks - particles stretch toward camera on scroll
    // Clamp velocity to prevent infinite lines on fast scroll
    float clampedVelocity = clamp(uScrollVelocity, 0.0, 5.0);

    // Direction from particle to camera (simplified as -Z for forward motion effect)
    vec3 stretchDir = vec3(0.0, -1.0, 0.0);
    float stretchAmount = clampedVelocity * 0.4 * (1.0 - smoothProgress * 0.5);
    pos += stretchDir * stretchAmount;

    vAlpha = smoothProgress;
    vStretch = clampedVelocity;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Elongate point size based on velocity (clamped)
    float baseSize = 2.5 * (300.0 / -mvPosition.z) * (0.3 + smoothProgress * 0.7);
    gl_PointSize = baseSize * (1.0 + clampedVelocity * 0.6);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStretch;

  uniform float uGlow;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Soft edge
    float alpha = smoothstep(0.5, 0.2, dist);

    // Very subtle glow - minimal brightness boost
    // Add extra brightness when stretching for "light trail" effect
    float stretchGlow = vStretch * 0.15;
    vec3 finalColor = vColor * (1.0 + uGlow * 0.12 + stretchGlow);

    // Slightly fade alpha during stretch for trail effect
    float stretchFade = 1.0 - vStretch * 0.1;
    gl_FragColor = vec4(finalColor, alpha * vAlpha * (0.9 + uGlow * 0.05) * stretchFade);
  }
`

interface PixelPoint {
  position: THREE.Vector3
  color: THREE.Color
}

function useLogoPoints(imagePath: string, totalParticles: number, scale: number): PixelPoint[] {
  const [points, setPoints] = useState<PixelPoint[]>([])

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
      const validPixels: { x: number; y: number; r: number; g: number; b: number }[] = []

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3]

          // Filter out transparent and white background pixels
          const isBackground = a < 128 || (r > 240 && g > 240 && b > 240)

          if (!isBackground) {
            validPixels.push({ x, y, r, g, b })
          }
        }
      }

      if (validPixels.length === 0) return

      const sampledPoints: PixelPoint[] = []
      for (let i = 0; i < totalParticles; i++) {
        const pixel = validPixels[Math.floor(Math.random() * validPixels.length)]

        const px = (pixel.x - canvas.width / 2) * scale
        const py = (canvas.height / 2 - pixel.y) * scale
        const pz = 0

        const color = new THREE.Color(pixel.r / 255, pixel.g / 255, pixel.b / 255)
        color.multiplyScalar(1.15)

        sampledPoints.push({ position: new THREE.Vector3(px, py, pz), color })
      }

      const box = new THREE.Box3()
      sampledPoints.forEach(p => box.expandByPoint(p.position))
      const size = box.getSize(new THREE.Vector3())

      // Match PNG display size (w-96 = 384px on md+)
      // With camera at z=20 and fov=50, we need ~11.5 units width
      // Logo aspect ratio is 851:490 (1.74:1)
      const targetWidth = 11.5
      const normalizeScale = targetWidth / size.x

      sampledPoints.forEach(p => p.position.multiplyScalar(normalizeScale))

      // Offset particles to match PNG position
      const xOffset = 0  // Adjust left (-) or right (+) if needed
      const yOffset = 3.0
      sampledPoints.forEach(p => {
        p.position.x += xOffset
        p.position.y += yOffset
      })

      setPoints(sampledPoints)
    }
    img.src = imagePath
  }, [imagePath, totalParticles, scale])

  return points
}

interface AircraftParticlesProps {
  stage?: IntroStage
  scrollVelocity?: number
  particleCount?: number
}

export default function AircraftParticles({ stage = 'assembling', scrollVelocity = 0, particleCount = TOTAL_PARTICLES }: AircraftParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const startTimeRef = useRef<number | null>(null)

  // Use the transparent background version
  const vertices = useLogoPoints('/GenLogoNoBackground.png', particleCount, 0.02)

  const geometry = useMemo(() => {
    if (vertices.length === 0) return null

    const geo = new THREE.BufferGeometry()

    const instancePositions = new Float32Array(vertices.length * 3)
    const targetPositions = new Float32Array(vertices.length * 3)
    const colors = new Float32Array(vertices.length * 3)

    vertices.forEach((vertex, i) => {
      instancePositions[i * 3] = (Math.random() - 0.5) * DISPERSION_RADIUS * 2
      instancePositions[i * 3 + 1] = (Math.random() - 0.5) * DISPERSION_RADIUS
      instancePositions[i * 3 + 2] = (Math.random() - 0.5) * DISPERSION_RADIUS

      targetPositions[i * 3] = vertex.position.x
      targetPositions[i * 3 + 1] = vertex.position.y
      targetPositions[i * 3 + 2] = vertex.position.z

      colors[i * 3] = vertex.color.r
      colors[i * 3 + 1] = vertex.color.g
      colors[i * 3 + 2] = vertex.color.b
    })

    geo.setAttribute('instancePosition', new THREE.BufferAttribute(instancePositions, 3))
    geo.setAttribute('targetPosition', new THREE.BufferAttribute(targetPositions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('position', new THREE.BufferAttribute(targetPositions.slice(), 3))

    return geo
  }, [vertices])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uProgress: { value: 0 },
        uGlow: { value: 0 },
        uTime: { value: 0 },
        uScrollVelocity: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  }, [])

  useFrame((state) => {
    if (!materialRef.current || vertices.length === 0) return

    const mat = materialRef.current

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uScrollVelocity.value = scrollVelocity

    if (stage === 'loading') {
      mat.uniforms.uProgress.value = 0
      mat.uniforms.uGlow.value = 0
    } else if (stage === 'assembling') {
      const progress = Math.min(elapsed / BUILD_DURATION, 1)
      mat.uniforms.uProgress.value = easeOutCubic(progress)
      mat.uniforms.uGlow.value = 0
    } else if (stage === 'glowing') {
      mat.uniforms.uProgress.value = 1
      // Quick subtle flash - faster decay, lower intensity
      const glowTime = elapsed - BUILD_DURATION
      const flashIntensity = Math.exp(-glowTime * 8) * 0.2
      mat.uniforms.uGlow.value = Math.max(0.02, flashIntensity)
    } else if (stage === 'revealing' || stage === 'complete') {
      mat.uniforms.uProgress.value = 1
      mat.uniforms.uGlow.value = 0.1
    }
  })

  if (!geometry) return null

  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive object={material} ref={materialRef} attach="material" />
    </points>
  )
}
