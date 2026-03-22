'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Loader2, RefreshCw } from 'lucide-react'

export default function PortalSettingsPage() {
  const router = useRouter()
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; recoveryCodesRemaining: number } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    const res = await fetch('/api/portal/mfa/status')
    if (res.ok) {
      setMfaStatus(await res.json())
    }
  }

  async function handleChangeAuthenticator(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/portal/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset MFA')

      // Redirect to re-enrollment
      router.push('/portal/mfa-setup')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Account Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-navy-700" />
          <h2 className="text-lg font-semibold text-navy-900">Two-Factor Authentication</h2>
        </div>

        {!mfaStatus ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div>
                <p className="font-semibold text-green-800">MFA is enabled</p>
                <p className="text-sm text-green-600">
                  {mfaStatus.recoveryCodesRemaining} recovery code{mfaStatus.recoveryCodesRemaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>

            {mfaStatus.recoveryCodesRemaining <= 2 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">
                  You&apos;re running low on recovery codes. Consider changing your authenticator to generate new codes.
                </p>
              </div>
            )}

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Change Authenticator
              </button>
            ) : (
              <form onSubmit={handleChangeAuthenticator} className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">
                  Enter your current authenticator code or a recovery code to confirm.
                </p>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="Enter code"
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none text-navy-900 font-mono text-center"
                  autoFocus
                  required
                />
                {error && (
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoading || !confirmCode.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Confirm & Re-enroll
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowConfirm(false); setError(''); setConfirmCode('') }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
