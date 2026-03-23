'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  FileText,
  MessageSquarePlus,
  FolderOpen,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/portal/sales-orders', label: 'Sales Orders', icon: ShoppingCart },
  { href: '/portal/repair-orders', label: 'Repair Orders', icon: Wrench },
  { href: '/portal/invoices', label: 'Invoices', icon: FileText },
  { href: '/portal/quotes', label: 'Quotes', icon: MessageSquarePlus },
  { href: '/portal/documents', label: 'Documents', icon: FolderOpen },
]

export default function PortalNav() {
  const pathname = usePathname()

  return (
    <nav
      className="bg-navy-900 border-b border-navy-800"
      aria-label="Portal navigation"
    >
      <div className="container mx-auto px-4">
        <ul className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="list">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0',
                    isActive
                      ? 'border-burgundy-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-navy-600',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
