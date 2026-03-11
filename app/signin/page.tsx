import { signIn } from '@/auth'
import { Shield, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'Access denied — only @genthrust.net accounts are allowed.',
  Configuration: 'Server configuration error. Contact your administrator.',
  OAuthCallback: 'Microsoft sign-in failed. Please try again.',
  OAuthSignin: 'Could not start Microsoft sign-in. Please try again.',
  Default: 'An authentication error occurred. Please try again.',
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorCode = searchParams.error
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default
    : null

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
        <h1 className="text-2xl font-extrabold text-navy-900 mb-2">Team Sign In</h1>
        <p className="text-slate-600 mb-8 font-medium">Internal team access only.</p>

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border-2 border-red-200 mb-6 text-left">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-800">{errorMessage}</p>
          </div>
        )}

        <form
          action={async () => {
            'use server'
            await signIn('microsoft-entra-id', { redirectTo: '/internal' })
          }}
        >
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-navy-600 rounded-lg hover:bg-navy-700 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
          >
            <Shield className="w-5 h-5" />
            Sign in with Microsoft
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6">
          Contact your administrator if you need access.
        </p>

        <Link href="/" className="text-xs text-slate-400 hover:text-slate-300 mt-4 inline-block">
          &larr; Back to website
        </Link>
      </div>
    </div>
  )
}
