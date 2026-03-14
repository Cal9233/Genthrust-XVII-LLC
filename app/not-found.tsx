import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center animate-fade-in-up">
        <p className="text-8xl font-bold text-navy-600 leading-none mb-4 tabular-nums">
          404
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 mb-3">
          Page Not Found
        </h1>
        <p className="text-slate-500 mb-8 text-balance">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
