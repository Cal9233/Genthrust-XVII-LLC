export default function InternalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-navy-900">Dashboard Overview</h1>
        <p className="text-slate-600 mt-2">Welcome to the Genthrust internal portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">Inventory Sync</h2>
          <p className="text-slate-600 mb-4 text-sm">
            Manage and sync aircraft parts inventory.
          </p>
        </div>
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">Quote Requests</h2>
          <p className="text-slate-600 mb-4 text-sm">
            View recent AOG and standard part requests.
          </p>
        </div>
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">Team Directory</h2>
          <p className="text-slate-600 text-sm">Manage internal team access.</p>
        </div>
      </div>
    </div>
  )
}
