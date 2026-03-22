'use client'

import { useRouter } from 'next/navigation'
import MfaEnrollment from '@/components/portal/MfaEnrollment'

export default function MfaSetupPage() {
  const router = useRouter()

  function handleComplete() {
    // Force session refresh by navigating — the layout will re-check mfaEnabled
    router.push('/portal')
    router.refresh()
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <MfaEnrollment onComplete={handleComplete} />
      </div>
    </div>
  )
}
