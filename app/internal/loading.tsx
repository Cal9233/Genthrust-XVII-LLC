export default function InternalLoading() {
  return (
    <div className="flex-1 p-6" role="status" aria-label="Loading dashboard">
      <span className="sr-only">Loading...</span>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="skeleton h-3 w-24 mb-3" />
            <div className="skeleton h-7 w-16 mb-2" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="skeleton h-4 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="skeleton h-4 w-4 flex-shrink-0 rounded-full" />
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
