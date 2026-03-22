'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Database,
  Zap,
  Users,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react'

const tabs = [
  { href: '/internal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/internal/bots', label: 'Bots', icon: Bot, exact: false },
  { href: '/internal/erp', label: 'ERP', icon: Database, exact: false },
  { href: '/internal/automation', label: 'Automation', icon: Zap, exact: false },
  { href: '/internal/clients', label: 'Clients', icon: Users, exact: false },
  { href: '/internal/audit-log', label: 'Audit Log', icon: ShieldCheck, exact: false },
]

export default function TabNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(tab: (typeof tabs)[0]) {
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
  }

  return (
    <>
      {/* Desktop tab strip */}
      <nav className="border-t border-navy-800 hidden sm:block" aria-label="Main navigation">
        <div className="container mx-auto px-4 flex items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  active
                    ? 'bg-navy-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800/50'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-burgundy-500"
                    aria-hidden="true"
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile hamburger strip */}
      <div className="sm:hidden border-t border-navy-800" aria-label="Main navigation">
        <div className="container mx-auto px-4 flex items-center justify-between h-11">
          <span className="text-sm text-slate-300 font-medium">
            {tabs.find(isActive)?.label ?? 'Navigate'}
          </span>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            className="p-1.5 text-slate-400 hover:text-white transition-colors rounded"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="container mx-auto px-4 pb-3 flex flex-col gap-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = isActive(tab)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded transition-colors ${
                    active
                      ? 'bg-navy-800 text-white border-l-2 border-burgundy-500'
                      : 'text-slate-400 hover:text-white hover:bg-navy-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </>
  )
}
