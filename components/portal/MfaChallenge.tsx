'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react'

interface MfaChallengeProps {
  onSubmit: (code: string) => Promise<void>
  error?: string
}

export default function MfaChallenge({ onSubmit, error }: MfaChallengeProps) {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [useRecovery, setUseRecovery] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setIsLoading(true)
    try {
      await onSubmit(code.trim())
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-100 mb-4">
          <ShieldCheck className="w-8 h-8 text-navy-700" />
        </div>
        <h2 className="text-xl font-bold text-navy-900">Two-Factor Authentication</h2>
        <p className="text-slate-600 mt-1 text-sm">
          {useRecovery
            ? 'Enter one of your recovery codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mfa-code" className="block text-sm font-semibold text-navy-900 mb-2">
            {useRecovery ? 'Recovery Code' : 'Authentication Code'}
          </label>
          <input
            id="mfa-code"
            type="text"
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={useRecovery ? 'XXXXXXXX' : '000000'}
            className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400 text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border-2 border-red-200">
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || (!useRecovery && code.length !== 6) || (useRecovery && !code.trim())}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShieldCheck className="w-5 h-5" />
          )}
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseRecovery(!useRecovery)
          setCode('')
        }}
        className="w-full text-sm text-slate-500 hover:text-navy-700 transition-colors flex items-center justify-center gap-1"
      >
        <KeyRound className="w-4 h-4" />
        {useRecovery ? 'Use authenticator app instead' : 'Use a recovery code'}
      </button>
    </div>
  )
}
