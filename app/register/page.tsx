'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UserPlus, Loader2, CheckCircle } from 'lucide-react'
import Image from 'next/image'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [contactName, setContactName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleCompanyChange(value: string) {
    setCompanyName(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length < 1) {
      setCompanySuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/register/companies?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          setCompanySuggestions(data)
          setShowSuggestions(data.length > 0)
        }
      } catch {
        // ignore autocomplete errors
      }
    }, 300)
  }

  function selectCompany(name: string) {
    setCompanyName(name)
    setShowSuggestions(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          contact_name: contactName,
          company_name: companyName || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-navy-900 mb-2">Registration Submitted</h1>
          <p className="text-slate-600 mb-6">
            Your account is pending admin approval. You will be able to sign in once approved.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-burgundy-600 rounded-lg hover:bg-burgundy-700 transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
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
        <p className="text-slate-600 mb-8 font-medium">Create a new account.</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="contact_name" className="block text-sm font-semibold text-navy-900 mb-2">
              Full Name
            </label>
            <input
              id="contact_name"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
              required
            />
          </div>
          <div>
            <label htmlFor="reg_email" className="block text-sm font-semibold text-navy-900 mb-2">
              Email
            </label>
            <input
              id="reg_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
              required
            />
          </div>
          <div>
            <label htmlFor="reg_password" className="block text-sm font-semibold text-navy-900 mb-2">
              Password
            </label>
            <input
              id="reg_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              minLength={8}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
              required
            />
          </div>
          <div className="relative" ref={suggestionsRef}>
            <label htmlFor="company_name" className="block text-sm font-semibold text-navy-900 mb-2">
              Company Name
            </label>
            <input
              id="company_name"
              type="text"
              value={companyName}
              onChange={(e) => handleCompanyChange(e.target.value)}
              onFocus={() => companySuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Start typing to search..."
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-electric-blue focus:outline-none transition-colors text-navy-900 placeholder:text-slate-400"
              autoComplete="off"
            />
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {companySuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCompany(c.company_name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-900 hover:bg-slate-50 transition-colors"
                  >
                    {c.company_name}
                  </button>
                ))}
              </div>
            )}
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
              <UserPlus className="w-5 h-5" />
            )}
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-burgundy-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>

        <Link href="/" className="text-xs text-slate-400 hover:text-slate-300 mt-4 inline-block">
          &larr; Back to website
        </Link>
      </div>
    </div>
  )
}
