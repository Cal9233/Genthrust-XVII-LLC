import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/sections/HeroSection'
import { StatsBar } from '@/components/sections/StatsBar'
import { ServicesBento } from '@/components/sections/ServicesBento'
import { WhyGenthrust } from '@/components/sections/WhyGenthrust'

export default function Home() {
  return (
    <main className="bg-white text-navy">
      <Navbar />
      <HeroSection />
      <StatsBar />
      <ServicesBento />
      <WhyGenthrust />
      <Footer />
    </main>
  )
}
