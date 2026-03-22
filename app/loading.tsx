import Image from 'next/image'

/**
 * Root loading state — shown by Next.js while a page segment suspends.
 * Uses branded skeleton rather than a blank screen.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 px-4"
      role="status"
      aria-label="Loading page"
    >
      {/* Branded logo — pulsing to signal activity */}
      <Image
        src="/GenLogoNoBackground.png"
        alt=""
        aria-hidden="true"
        width={200}
        height={115}
        className="opacity-[0.18] animate-pulse select-none"
        priority
      />

      {/* Sequential dot indicator */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span
            className="w-2 h-2 rounded-full bg-navy-600 animate-pulse"
            style={{ animationDelay: '0ms', animationDuration: '1.2s' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-navy-600 animate-pulse"
            style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-navy-600 animate-pulse"
            style={{ animationDelay: '400ms', animationDuration: '1.2s' }}
          />
        </div>
        <p className="text-[11px] font-mono text-slate-400 uppercase tracking-[0.2em]" aria-hidden="true">
          Loading
        </p>
      </div>

      {/* Screen-reader accessible label */}
      <span className="sr-only">Loading, please wait…</span>
    </div>
  )
}
