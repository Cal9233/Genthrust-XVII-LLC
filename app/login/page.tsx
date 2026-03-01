import { Users } from 'lucide-react'
import Image from 'next/image'

export default function ClientLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/GenLogoTab.png"
            alt="GENTHRUST"
            width={64}
            height={64}
            className="w-16 h-16"
          />
        </div>
        <h1 className="text-2xl font-extrabold text-navy-900 mb-2">Client Portal</h1>
        <p className="text-slate-600 mb-8 font-medium">Sign in to access your account.</p>

        <form className="space-y-4 text-left">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-navy-900 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-navy-900 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 mt-2"
          >
            <Users className="w-5 h-5" />
            Sign In
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6">
          Contact your account representative if you need access.
        </p>
      </div>
    </div>
  )
}
