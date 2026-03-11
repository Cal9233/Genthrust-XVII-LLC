'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bot, BarChart3, Zap, Users, Bell } from 'lucide-react'

const navItems = [
  { href: '/internal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/internal/bots', label: 'Bots', icon: Bot },
  { href: '/internal/inventory-intelligence', label: 'Inventory Intel', icon: BarChart3 },
  { href: '/internal/inventory-alarms', label: 'Alarms', icon: Bell },
  { href: '/internal/automation', label: 'Automation', icon: Zap },
  { href: '/internal/clients', label: 'Clients', icon: Users },
]

export default function InternalNav() {
  const pathname = usePathname()

  return (
    <nav className="border-t border-navy-800">
      <div className="container mx-auto px-4 flex items-center gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/internal'
              ? pathname === '/internal'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-navy-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-navy-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
