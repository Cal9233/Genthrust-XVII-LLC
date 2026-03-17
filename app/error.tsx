'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-card p-8 text-center animate-fade-in">

        {/* Branded logo — muted */}
        <div className="mb-4">
          <Image
            src="/GenLogoNoBackground.png"
            alt="GENTHRUST XVII"
            width={120}
            height={69}
            className="mx-auto opacity-25"
          />
        </div>

        {/* Error icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-burgundy-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-burgundy-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Something went wrong
        </h1>

        <p className="text-sm text-slate-500 mb-4">
          An unexpected error occurred. Our team has been notified.
        </p>

        {error.message && (
          <p className="text-sm text-slate-500 font-mono bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6 text-left break-words">
            {error.message}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
          >
            Go Home
          </Link>
        </div>

        {/* Error digest for support tracing */}
        {error.digest && (
          <p className="mt-6 text-[10px] font-mono text-slate-300 tabular-nums">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
