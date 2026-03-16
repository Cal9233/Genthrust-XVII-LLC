'use client'

import { useState, useEffect } from 'react'
import SideNav from '@/components/internal/SideNav'
import Topbar from '@/components/internal/Topbar'

interface InternalShellProps {
  children: React.ReactNode
  userName?: string | null
  userEmail?: string | null
  userImage?: string | null
  userInitials?: string
}

export default function InternalShell({
  children,
  userName,
  userEmail,
  userImage,
  userInitials = 'GT',
}: InternalShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore sidebar state from localStorage on mount (hydration-safe)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Persist sidebar state to localStorage on every toggle
  function handleCollapse(next: boolean) {
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const sidebarWidth = collapsed ? 64 : 220

  return (
    <>
      <SideNav
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        userInitials={userInitials}
        collapsed={collapsed}
        onCollapse={handleCollapse}
      />

      {/* Topbar — fixed, so its left offset must track the sidebar */}
      <Topbar
        userName={userName}
        userImage={userImage}
        userInitials={userInitials}
        sidebarWidth={sidebarWidth}
      />

      {/* Content area — slides with sidebar */}
      <main
        style={{ paddingLeft: sidebarWidth, paddingTop: 48 }}
        className="min-h-screen transition-[padding-left] duration-200 ease-in-out"
      >
        <div className="px-6 py-6">
          {children}
        </div>
      </main>
    </>
  )
}
