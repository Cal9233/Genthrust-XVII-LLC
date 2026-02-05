import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/sections/HeroSection'
import { SearchSection } from '@/components/sections/SearchSection'
import { CredentialsSection } from '@/components/sections/CredentialsSection'
import { FeaturedInventory } from '@/components/sections/FeaturedInventory'
import { ContactSection } from '@/components/sections/ContactSection'

export default function Home() {
  return (
    <main className="bg-white text-slate-900">
      <Navbar />
      <HeroSection />
      <SearchSection />
      <CredentialsSection />
      <FeaturedInventory />
      <ContactSection />
      <Footer />
    </main>
  )
}
