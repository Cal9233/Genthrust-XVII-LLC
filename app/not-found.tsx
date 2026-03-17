import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center animate-fade-in-up">
        {/* Branded logo — muted so the 404 number stands out */}
        <div className="mb-6">
          <Image
            src="/GenLogoNoBackground.png"
            alt="GENTHRUST XVII"
            width={160}
            height={92}
            className="mx-auto opacity-30"
          />
        </div>

        {/* 404 heading */}
        <p className="text-8xl font-bold text-navy-600 leading-none mb-4 tabular-nums">
          404
        </p>

        <h1 className="text-2xl font-semibold text-slate-900 mb-3">
          Page Not Found
        </h1>

        <p className="text-slate-500 mb-8 text-balance max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          Try going home or searching our parts inventory.
        </p>

        {/* Primary actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
          >
            Go Home
          </Link>
          <Link
            href="/#search"
            className="inline-flex items-center justify-center px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
          >
            Search Parts
          </Link>
        </div>

        {/* Secondary links */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/contact" className="hover:text-navy-600 transition-colors">Contact Us</Link>
          <span aria-hidden="true">·</span>
          <Link href="/services" className="hover:text-navy-600 transition-colors">Our Services</Link>
          <span aria-hidden="true">·</span>
          <Link href="/about" className="hover:text-navy-600 transition-colors">About</Link>
        </div>
      </div>
    </div>
  )
}
