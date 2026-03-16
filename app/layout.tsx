import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600'],
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
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
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className={`${ibmPlexSans.className} overflow-x-hidden min-h-screen bg-white`}>
        {children}
      </body>
    </html>
  )
}
