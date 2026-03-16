'use client'

import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

const routeLabels: Record<string, string> = {
  '/internal':            'Dashboard',
  '/internal/bots':       'Bots',
  '/internal/erp':        'ERP',
  '/internal/automation': 'Automation',
  '/internal/clients':    'Clients',
  '/internal/audit-log':  'Audit Log',
}

function getActiveLabel(pathname: string): string {
  // Exact match first, then prefix match
  if (routeLabels[pathname]) return routeLabels[pathname]
  const match = Object.entries(routeLabels).find(
    ([route]) => route !== '/internal' && pathname.startsWith(route)
  )
  return match ? match[1] : 'Dashboard'
}

interface TopbarProps {
  userName?: string | null
  userImage?: string | null
  userInitials?: string
  sidebarWidth?: number
}

export default function Topbar({
  userName,
  userImage,
  userInitials = 'GT',
  sidebarWidth = 220,
}: TopbarProps) {
  const pathname = usePathname()
  const activeLabel = getActiveLabel(pathname)

  const [timestamp, setTimestamp] = useState<string>('')

  useEffect(() => {
    function update() {
      setTimestamp(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      style={{ paddingLeft: sidebarWidth }}
      className="fixed top-0 right-0 h-12 z-30 flex items-center justify-between px-6
        bg-[#111827] border-b border-white/[0.06]
        transition-[padding-left] duration-200 ease-in-out"
      aria-label="Top bar"
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm">
          <li>
            <span className="text-[#8b949e] font-medium">Genthrust</span>
          </li>
          <li aria-hidden="true">
            <span className="text-[#484f58]">›</span>
          </li>
          <li>
            <span className="text-[#f0f6fc] font-medium">{activeLabel}</span>
          </li>
        </ol>
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Refresh timestamp */}
        {timestamp && (
          <div className="hidden sm:flex items-center gap-1.5 text-[#484f58]" aria-label="Current time">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span className="text-[11px] font-mono tabular-nums">{timestamp}</span>
          </div>
        )}

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-white/[0.08]" aria-hidden="true" />

        {/* User avatar pill */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full bg-[#9c2a3e] flex items-center justify-center
              font-bold text-xs text-white flex-shrink-0 overflow-hidden"
            aria-label={userName ? `Signed in as ${userName}` : 'User avatar'}
          >
            {userImage ? (
              <img
                src={userImage}
                alt={userName ?? 'User avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              userInitials
            )}
          </div>
          {userName && (
            <span className="hidden md:block text-xs font-medium text-[#8b949e] truncate max-w-[120px]">
              {userName}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
