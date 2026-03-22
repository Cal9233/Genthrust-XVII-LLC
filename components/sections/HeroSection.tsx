'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Three.js / framer-motion scroll hooks
const HeroIntro = dynamic(
  () => import('@/components/Hero/HeroIntro'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full bg-space flex items-center justify-center">
        <div className="w-12 h-12 border border-horizon-blue/30 border-t-horizon-blue rounded-full animate-spin" />
      </div>
    ),
  }
)

export function HeroSection() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <HeroIntro />
      {/* Fade into the next section (dark Bento) */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-space to-transparent pointer-events-none z-30" />
    </section>
  )
}
