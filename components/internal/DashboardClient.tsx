'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import StatusOverviewGrid from '@/components/internal/StatusOverviewGrid'
import type { StatusOverviewData } from '@/components/internal/StatusOverviewGrid'

/** Wraps fetch with an AbortController timeout (default 10s). */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs = 10000, ...fetchInit } = init || {}
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...fetchInit, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out — service may be unavailable')
      }
      throw err
    })
    .finally(() => clearTimeout(timer))
}

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
      const res = await fetchWithTimeout('/api/internal/status-overview')
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
          <AlertCircle className="w-10 h-10 text-[#f85149] mx-auto mb-3" />
          <p className="text-[#f85149] font-medium">{error}</p>
          <button onClick={loadOverview} className="mt-3 text-sm text-[#58a6ff] hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const greeting = getGreeting()

  return (
    <div className="space-y-8" style={{ animation: 'fadeInUp 0.2s ease-out both' }}>
      {/* Header */}
      <div
        className="flex items-start justify-between opacity-0 animate-[fadeInUp_0.3s_ease_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <p className="text-xs font-medium text-[#8b949e] uppercase tracking-widest mb-1">
            {greeting}
          </p>
          <h1 className="text-xl font-semibold text-[#f0f6fc]">
            {userName.split(' ')[0]}
          </h1>
          <p className="text-[#484f58] mt-1 text-xs font-mono tabular-nums">
            last refresh {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadOverview}
          disabled={loading}
          aria-label="Refresh dashboard"
          className="p-2 rounded-lg text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-50 mt-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Overview Grid */}
      <div
        className="opacity-0 animate-[fadeInUp_0.3s_ease_forwards]"
        style={{ animationDelay: '80ms' }}
      >
        <StatusOverviewGrid data={data} loading={loading} />
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
