'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function DetailDrawer({ open, onClose, title, subtitle, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]
          transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 right-0 h-full w-full sm:w-[560px] z-50 flex flex-col
          bg-[#161b22] border-l border-white/[0.08]
          shadow-[−20px_0_60px_rgba(0,0,0,0.5)]
          transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#f0f6fc] tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[#8b949e] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded text-[#8b949e] hover:text-[#f0f6fc] hover:bg-white/[0.06]
              transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-6 py-5"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}

/**
 * DrawerMetaGrid — 2-column field grid for displaying entity metadata inside a drawer.
 *
 * Usage:
 *   <DrawerMetaGrid fields={[
 *     { label: 'RO Number', value: 'RO-00123' },
 *     { label: 'Status', value: <StatusBadge status="Open" /> },
 *   ]} />
 */
interface DrawerField {
  label: string
  value: React.ReactNode
}

export function DrawerMetaGrid({ fields }: { fields: DrawerField[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((field, i) => (
        <div
          key={i}
          className="bg-[#0b0f14] rounded-md px-3 py-2.5 border border-white/[0.05]"
        >
          <p className="text-[10px] text-[#8b949e] font-medium uppercase tracking-wide mb-1">
            {field.label}
          </p>
          <div className="text-sm text-[#f0f6fc]">{field.value}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * DrawerLineItems — nested table inside a drawer for listing line items.
 */
interface LineItemColumn<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
}

interface DrawerLineItemsProps<T extends Record<string, any>> {
  columns: LineItemColumn<T>[]
  rows: T[]
}

export function DrawerLineItems<T extends Record<string, any>>({
  columns,
  rows,
}: DrawerLineItemsProps<T>) {
  return (
    <div className="rounded-md border border-white/[0.06] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#1a2233]">
            {columns.map(col => (
              <th
                key={col.key}
                className={`text-[10px] text-[#8b949e] uppercase tracking-wide px-3 py-2 text-left
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-3 py-2 text-xs text-[#f0f6fc]
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                >
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="border-t border-white/[0.04]">
              <td colSpan={columns.length} className="px-3 py-4 text-center text-xs text-[#484f58]">
                No items
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
