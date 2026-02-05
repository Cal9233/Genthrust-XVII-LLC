import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export const metadata: Metadata = {
  title: 'GENTHRUST XVII LLC | Aircraft Parts & Components',
  description:
    'GENTHRUST XVII LLC supplies aircraft parts and components of the highest quality. Over 25 years of experience in the aircraft spares supply chain. Same day delivery from Miami, FL.',
  keywords: [
    'aviation parts',
    'aircraft components',
    'certified parts',
    'AOG support',
    'aircraft parts supplier',
    'aviation supply chain',
    'airframe components',
    'powerplant parts',
    'Miami aircraft parts',
    'same day delivery',
  ],
  icons: {
    icon: '/GenLogoTab.png',
    apple: '/GenLogoTab.png',
  },
  openGraph: {
    title: 'GENTHRUST XVII LLC | Aircraft Parts & Components',
    description: 'Supplying aircraft parts and components of the highest quality. 25+ years of experience, same day delivery.',
    type: 'website',
    locale: 'en_US',
    siteName: 'GENTHRUST XVII LLC',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GENTHRUST XVII LLC | Aircraft Parts & Components',
    description: 'Supplying aircraft parts and components of the highest quality. 25+ years of experience.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} overflow-x-hidden min-h-screen bg-white`}>
        {children}
      </body>
    </html>
  )
}
