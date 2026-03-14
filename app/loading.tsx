export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex gap-2" role="status" aria-label="Loading">
        <span className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse" style={{ animationDelay: '300ms' }} />
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  )
}
