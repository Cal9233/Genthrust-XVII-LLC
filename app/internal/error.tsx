'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function InternalError({
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
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#161b22] border border-white/[0.06] rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#f85149]/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[#f85149]"
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

        <h1 className="text-xl font-semibold text-[#f0f6fc] mb-2">
          Something went wrong
        </h1>

        {error.message && (
          <p className="text-sm text-[#8b949e] font-mono bg-[#0b0f14] border border-white/[0.06] rounded-lg px-4 py-3 mb-6 text-left break-words">
            {error.message}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#1f6feb] hover:bg-[#388bfd] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/internal"
            className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.09] text-[#f0f6fc] text-sm font-medium rounded-lg border border-white/[0.06] transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
