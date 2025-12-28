import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'GENTHRUST | Powering Global Aviation',
  description:
    'Your trusted partner for buying, selling, and repairing certified aircraft components. 24/7 AOG support, 500K+ parts available.',
  keywords: [
    'aviation parts',
    'aircraft components',
    'MRO services',
    'AOG support',
    'aircraft parts brokerage',
    'aviation supply chain',
  ],
  openGraph: {
    title: 'GENTHRUST | Powering Global Aviation',
    description: 'Your trusted partner for certified aircraft components and repair services.',
    type: 'website',
    locale: 'en_US',
    siteName: 'GENTHRUST',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GENTHRUST | Powering Global Aviation',
    description: 'Your trusted partner for certified aircraft components and repair services.',
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
      <body className={`${inter.className} overflow-x-hidden`}>{children}</body>
    </html>
  )
}
