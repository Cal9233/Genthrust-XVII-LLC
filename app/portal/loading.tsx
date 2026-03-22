export default function PortalLoading() {
  return (
    <div className="flex-1 p-6" role="status" aria-label="Loading portal">
      <span className="sr-only">Loading...</span>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="skeleton h-3 w-20 mb-3" />
            <div className="skeleton h-7 w-14 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Recent activity cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="skeleton h-4 w-36 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="skeleton h-3 flex-1" />
                  <div className="skeleton h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
