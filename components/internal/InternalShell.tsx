'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore sidebar collapsed state from localStorage on mount (hydration-safe)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Close mobile drawer on route change (navigation)
  useEffect(() => {
    setMobileOpen(false)
  }, [])

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  function handleCollapse(next: boolean) {
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const handleMobileClose = useCallback(() => setMobileOpen(false), [])
  const handleMobileToggle = useCallback(() => setMobileOpen((o) => !o), [])

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
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />

      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          aria-hidden="true"
          onClick={handleMobileClose}
        />
      )}

      {/* Topbar — fixed, left offset tracks sidebar on desktop */}
      <Topbar
        userName={userName}
        userImage={userImage}
        userInitials={userInitials}
        sidebarWidth={sidebarWidth}
        onMobileMenuToggle={handleMobileToggle}
        mobileMenuOpen={mobileOpen}
      />

      {/* Content area — on mobile: no left padding (sidebar is overlay)
                       on desktop: slides with sidebar width */}
      <main
        className="internal-main min-h-screen pt-12"
        style={{ '--sidebar-offset': `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </>
  )
}
