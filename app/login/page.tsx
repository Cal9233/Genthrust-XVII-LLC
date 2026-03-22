'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Loader2 } from 'lucide-react'
import Image from 'next/image'
import MfaChallenge from '@/components/portal/MfaChallenge'

type LoginStep = 'credentials' | 'mfa'

export default function ClientLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [error, setError] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Step 1: Verify credentials and check MFA status
      const res = await fetch('/api/auth/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid email or password.')
        setIsLoading(false)
        return
      }

      if (data.mfaRequired && !data.needsEnrollment) {
        // User has MFA enabled — show TOTP input
        setMfaToken(data.mfaToken)
        setStep('mfa')
        setIsLoading(false)
        return
      }

      // No MFA or needs enrollment — sign in directly
      // (Portal layout will redirect to /portal/mfa-setup if enrollment needed)
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      setIsLoading(false)

      if (result?.error) {
        setError('Authentication failed. Please try again.')
        return
      }

      router.push('/portal')
    } catch {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  async function handleMfaSubmit(code: string) {
    setMfaError('')

    const result = await signIn('credentials', {
      mfaToken,
      totpCode: code,
      redirect: false,
    })

    if (result?.error) {
      setMfaError('Invalid code. Please try again.')
      return
    }

    router.push('/portal')
  }

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

        {step === 'credentials' ? (
          <>
            <form onSubmit={handleCredentialsSubmit} className="space-y-4 text-left">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-navy-900 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-navy-900 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
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
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Users className="w-5 h-5" />
                )}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-sm text-slate-500 mt-6">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-burgundy-600 font-semibold hover:underline">
                Register
              </Link>
            </p>

            <Link href="/" className="text-xs text-slate-400 hover:text-slate-300 mt-4 inline-block">
              &larr; Back to website
            </Link>
          </>
        ) : (
          <div className="text-left">
            <MfaChallenge onSubmit={handleMfaSubmit} error={mfaError} />
            <button
              onClick={() => { setStep('credentials'); setMfaError('') }}
              className="w-full text-sm text-slate-500 hover:text-navy-700 transition-colors mt-4"
            >
              &larr; Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
