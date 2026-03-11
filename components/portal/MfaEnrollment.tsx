'use client'

import { useState, useEffect } from 'react'
import { Loader2, ShieldCheck, Copy, Check, AlertTriangle } from 'lucide-react'

interface MfaEnrollmentProps {
  onComplete: () => void
}

type Step = 'loading' | 'qr' | 'verify' | 'recovery'

export default function MfaEnrollment({ onComplete }: MfaEnrollmentProps) {
  const [step, setStep] = useState<Step>('loading')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [manualSecret, setManualSecret] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [codesCopied, setCodesCopied] = useState(false)

  // Start enrollment on mount
  useEffect(() => {
    startEnrollment()
  }, [])

  async function startEnrollment() {
    setError('')
    setStep('loading')
    try {
      const res = await fetch('/api/portal/mfa/enroll', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enrollment failed')
      setQrCodeUrl(data.qrCodeUrl)
      setManualSecret(data.secret)
      setStep('qr')
    } catch (err: any) {
      setError(err.message)
      setStep('qr')
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/portal/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setRecoveryCodes(data.recoveryCodes)
      setStep('recovery')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(manualSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCodesCopied(true)
    setTimeout(() => setCodesCopied(false), 2000)
  }

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-navy-600" />
      </div>
    )
  }

  if (step === 'recovery') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <ShieldCheck className="w-8 h-8 text-green-700" />
          </div>
          <h2 className="text-xl font-bold text-navy-900">MFA Enabled Successfully</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Save these recovery codes in a safe place. Each code can only be used once.
          </p>
        </div>

        <div className="bg-slate-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-navy-900">Recovery Codes</span>
            <button
              onClick={copyCodes}
              className="inline-flex items-center gap-1 text-xs text-navy-600 hover:text-navy-800 transition-colors"
            >
              {codesCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {codesCopied ? 'Copied!' : 'Copy all'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code, i) => (
              <code key={i} className="bg-white px-3 py-2 rounded text-sm font-mono text-center text-navy-900 border border-slate-200">
                {code}
              </code>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            These codes will not be shown again. Store them securely — you&apos;ll need them if you lose access to your authenticator app.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors"
        >
          I&apos;ve Saved My Codes — Continue
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-100 mb-4">
          <ShieldCheck className="w-8 h-8 text-navy-700" />
        </div>
        <h2 className="text-xl font-bold text-navy-900">Set Up Two-Factor Authentication</h2>
        <p className="text-slate-600 mt-1 text-sm">
          Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </p>
      </div>

      {qrCodeUrl && (
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <img src={qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48" />
          </div>
        </div>
      )}

      <div className="bg-slate-100 rounded-lg p-3">
        <p className="text-xs text-slate-500 mb-1">Can&apos;t scan? Enter this key manually:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono text-navy-900 break-all">{manualSecret}</code>
          <button onClick={copySecret} className="shrink-0 p-1 text-slate-500 hover:text-navy-700">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="verify-code" className="block text-sm font-semibold text-navy-900 mb-2">
            Enter the 6-digit code to verify
          </label>
          <input
            id="verify-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400 text-center text-2xl tracking-[0.5em] font-mono"
            autoComplete="one-time-code"
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
          disabled={isLoading || code.length !== 6}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ShieldCheck className="w-5 h-5" />
          )}
          {isLoading ? 'Verifying...' : 'Verify & Enable MFA'}
        </button>
      </form>
    </div>
  )
}
