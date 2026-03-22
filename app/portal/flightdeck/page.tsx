import { Rocket } from 'lucide-react'

export default function PortalFlightDeck() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
        <Rocket className="w-8 h-8 text-blue-600" />
      </div>
      <h1 className="text-2xl font-extrabold text-navy-900 mb-2">FlightDeck</h1>
      <p className="text-slate-500 max-w-md mb-6">
        Your dedicated workspace for managing parts, quotes, and orders is coming soon.
        We&apos;ll notify you when access is available.
      </p>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
        Coming Soon
      </span>
    </div>
  )
}
