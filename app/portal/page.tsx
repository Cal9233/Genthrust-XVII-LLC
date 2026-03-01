export default function PortalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-navy-900">Client Dashboard</h1>
        <p className="text-slate-600 mt-2">Welcome to your Genthrust client portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">My Orders</h2>
          <p className="text-slate-600 mb-4 text-sm">
            View and track your current part orders.
          </p>
        </div>
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">Quote History</h2>
          <p className="text-slate-600 mb-4 text-sm">
            Review past and pending quote requests.
          </p>
        </div>
        <div className="card p-6 shadow-card hover:shadow-card-hover transition-shadow">
          <h2 className="text-xl font-bold text-navy-900 mb-2">Account Settings</h2>
          <p className="text-slate-600 text-sm">Manage your account and preferences.</p>
        </div>
      </div>
    </div>
  )
}
