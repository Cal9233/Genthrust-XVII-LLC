'use client'

import { motion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/sections/HeroSection'
import { StatsBar } from '@/components/sections/StatsBar'
import { ServicesBento } from '@/components/sections/ServicesBento'
import { WhyGenthrust } from '@/components/sections/WhyGenthrust'
import { fadeIn } from '@/lib/animations'

export default function Home() {
  return (
    <motion.main
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="bg-white text-navy overflow-x-hidden"
    >
      <Navbar />
      <HeroSection />
      <StatsBar />
      <ServicesBento />
      <WhyGenthrust />
      <Footer />
    </motion.main>
  )
}
