'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Bot,
  Database,
  Zap,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/internal',            label: 'Dashboard',  icon: LayoutDashboard, exact: true  },
  { href: '/internal/bots',       label: 'Bots',       icon: Bot,             exact: false },
  { href: '/internal/erp',        label: 'ERP',        icon: Database,        exact: false },
  { href: '/internal/automation', label: 'Automation', icon: Zap,             exact: false },
  { href: '/internal/clients',    label: 'Clients',    icon: Users,           exact: false },
  { href: '/internal/audit-log',  label: 'Audit Log',  icon: ShieldCheck,     exact: false },
]

interface SideNavProps {
  userName?: string | null
  userEmail?: string | null
  userImage?: string | null
  userInitials?: string
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

export default function SideNav({
  userName,
  userEmail,
  userImage,
  userInitials = 'GT',
  collapsed: collapsedProp,
  onCollapse,
}: SideNavProps) {
  const pathname = usePathname()
  const [internalCollapsed, setInternalCollapsed] = useState(false)

  // If external state control is provided, use it; otherwise use internal state
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed
  const setCollapsed = onCollapse !== undefined
    ? onCollapse
    : setInternalCollapsed

  function isActive(item: (typeof navItems)[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <aside
      aria-label="Main navigation"
      style={{ width: collapsed ? 64 : 220 }}
      className="fixed left-0 top-0 h-full z-40 flex flex-col
        bg-[#111827] border-r border-white/[0.06]
        transition-[width] duration-200 ease-in-out overflow-hidden"
    >
      {/* Logo zone */}
      <div className="h-16 flex items-center gap-2.5 px-4 flex-shrink-0 border-b border-white/[0.06]">
        <Image
          src="/GenLogoNoBackground.png"
          alt="GENTHRUST"
          width={28}
          height={28}
          className="h-7 w-auto flex-shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-wider text-[#f0f6fc] truncate leading-tight">
              GENTHRUST
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-widest
                text-[#c1506c] bg-[#9c2a3e]/15 px-1.5 py-0.5 rounded w-fit leading-tight mt-0.5"
            >
              INTERNAL
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                font-medium transition-all duration-150 cursor-pointer w-full
                ${active
                  ? 'text-[#f0f6fc] bg-[#1a2233]'
                  : 'text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.04]'
                }
              `}
            >
              {/* Active left border accent */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[4px] bottom-[4px] w-[3px] bg-[#9c2a3e] rounded-r-full"
                />
              )}
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom zone */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-2 space-y-0.5">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-full px-3 py-2 rounded-md text-sm
            text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.04]
            transition-all duration-150"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="ml-2 text-xs truncate">Collapse</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mx-1" />

        {/* User pill */}
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-md
            hover:bg-white/[0.04] cursor-default transition-colors"
          title={collapsed ? (userName ?? userEmail ?? '') : undefined}
        >
          <div
            className="w-7 h-7 rounded-full bg-[#9c2a3e] flex items-center justify-center
              font-bold text-xs text-white flex-shrink-0 overflow-hidden"
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
          {!collapsed && (
            <div className="min-w-0 flex-1">
              {userName && (
                <p className="text-xs font-medium text-[#f0f6fc] truncate leading-tight">
                  {userName}
                </p>
              )}
              {userEmail && (
                <p className="text-[10px] text-[#8b949e] truncate leading-tight">
                  {userEmail}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          aria-label="Sign out"
          title={collapsed ? 'Sign out' : undefined}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm
            text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/[0.06]
            transition-all duration-150"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span className="text-xs truncate">Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
