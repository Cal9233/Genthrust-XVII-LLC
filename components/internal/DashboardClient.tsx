'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import StatusOverviewGrid from '@/components/internal/StatusOverviewGrid'
import type { StatusOverviewData } from '@/components/internal/StatusOverviewGrid'

interface DashboardClientProps {
  userName: string
}

export default function DashboardClient({ userName }: DashboardClientProps) {
  const [data, setData] = useState<StatusOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function loadOverview() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/status-overview')
      if (!res.ok) throw new Error('Failed to load overview')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
    const interval = setInterval(loadOverview, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadOverview} className="mt-3 text-sm text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const greeting = getGreeting()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="flex items-start justify-between opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {userName.split(' ')[0]}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            System health overview &mdash; refreshed at {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadOverview}
          disabled={loading}
          aria-label="Refresh dashboard"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 mt-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Overview Grid */}
      <div
        className="opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
        style={{ animationDelay: '80ms' }}
      >
        <StatusOverviewGrid data={data} loading={loading} />
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
