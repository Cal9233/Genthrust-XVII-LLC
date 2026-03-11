'use client'

import { useState, useEffect } from 'react'

export interface WebGLCapabilities {
  tier: 0 | 1 | 2 | 3
  particleCount: number
  maxDpr: number
  supportsWebGL: boolean
  prefersReducedMotion: boolean
}

const TIER_CONFIG = {
  3: { particleCount: 35000, maxDpr: 2 },
  2: { particleCount: 15000, maxDpr: 1.5 },
  1: { particleCount: 5000, maxDpr: 1 },
  0: { particleCount: 0, maxDpr: 1 },
} as const

function detectCapabilities(): WebGLCapabilities {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion) {
    return { tier: 0, ...TIER_CONFIG[0], supportsWebGL: false, prefersReducedMotion: true }
  }

  // Probe WebGL support
  let webglVersion = 0
  let gpuRenderer = ''
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2')
    if (gl2) {
      webglVersion = 2
      const ext = gl2.getExtension('WEBGL_debug_renderer_info')
      if (ext) gpuRenderer = gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''
    } else {
      const gl1 = canvas.getContext('webgl')
      if (gl1) {
        webglVersion = 1
        const ext = gl1.getExtension('WEBGL_debug_renderer_info')
        if (ext) gpuRenderer = gl1.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''
      }
    }
  } catch {
    // WebGL not available
  }

  if (webglVersion === 0) {
    return { tier: 0, ...TIER_CONFIG[0], supportsWebGL: false, prefersReducedMotion }
  }

  // Gather device signals
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4
  const dpr = window.devicePixelRatio ?? 1
  const viewportWidth = window.innerWidth
  const isMobileViewport = viewportWidth < 768

  // Check for known low-end GPU strings
  const gpuLower = gpuRenderer.toLowerCase()
  const isLowEndGPU = /swiftshader|llvmpipe|software|mesa|mali-4|adreno [1-3]/i.test(gpuLower)
  const isIntegratedGPU = /intel|iris|uhd|hd graphics/i.test(gpuLower)
  const isDedicatedGPU = /nvidia|geforce|radeon|rx |rtx |gtx /i.test(gpuLower)

  // Score-based tier determination
  let score = 0

  // WebGL version
  if (webglVersion === 2) score += 2
  else score += 1

  // GPU type
  if (isLowEndGPU) score -= 2
  else if (isDedicatedGPU) score += 3
  else if (isIntegratedGPU) score += 1

  // Device memory
  if (deviceMemory >= 8) score += 2
  else if (deviceMemory >= 4) score += 1
  else score -= 1

  // CPU cores
  if (hardwareConcurrency >= 8) score += 1
  else if (hardwareConcurrency <= 2) score -= 1

  // DPR and viewport
  if (dpr >= 2 && !isMobileViewport) score += 1
  if (isMobileViewport) score -= 1

  // Map score to tier
  let tier: 0 | 1 | 2 | 3
  if (score >= 6) tier = 3
  else if (score >= 3) tier = 2
  else if (score >= 1) tier = 1
  else tier = 0

  return {
    tier,
    ...TIER_CONFIG[tier],
    supportsWebGL: true,
    prefersReducedMotion,
  }
}

export function useWebGLCapabilities(): WebGLCapabilities {
  const [capabilities, setCapabilities] = useState<WebGLCapabilities>({
    tier: 2,
    ...TIER_CONFIG[2],
    supportsWebGL: true,
    prefersReducedMotion: false,
  })

  useEffect(() => {
    setCapabilities(detectCapabilities())
  }, [])

  return capabilities
}
