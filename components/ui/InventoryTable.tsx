'use client'

import { motion } from 'framer-motion'
import { InventoryItem } from '@/types/inventory'
import { cn } from '@/lib/utils'
import { Package, AlertCircle } from 'lucide-react'

interface InventoryTableProps {
  items: InventoryItem[]
  isLoading?: boolean
}

export function InventoryTable({ items, isLoading }: InventoryTableProps) {
  const formatCurrency = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price)
  }

  const getSourceBadge = (sourceFile: string | null) => {
    if (!sourceFile) return null
    
    const sourceUpper = sourceFile.toUpperCase()
    if (sourceUpper.includes('STOCK') || sourceUpper.includes('ROOM')) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-electric-blue/20 text-electric-blue border border-electric-blue/30">
          STOCK ROOM
        </span>
      )
    } else if (sourceUpper.includes('BIN') || sourceUpper.includes('INVENTORY')) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
          BINS INVENTORY
        </span>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-electric-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Searching inventory...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="w-16 h-16 text-slate-400 mb-4" />
        <p className="text-xl text-slate-300 font-semibold mb-2">No results found</p>
        <p className="text-slate-400">Try adjusting your search terms</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50 backdrop-blur-xl">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/50">
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Part Number
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Condition
            </th>
            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Bin
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Sell Price
            </th>
            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Source
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {items.map((item, index) => {
            const isOutOfStock = item.quantity === 0
            return (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  'hover:bg-slate-800/50 transition-colors duration-200',
                  isOutOfStock && 'bg-red-950/30 hover:bg-red-950/40'
                )}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{item.part_number}</span>
                    {isOutOfStock && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-300">
                    {item.description || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-300">
                    {item.condition || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isOutOfStock ? 'text-red-400' : 'text-white'
                    )}
                  >
                    {item.quantity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-300">
                    {item.location || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-300">
                    {item.bin || '—'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-semibold text-electric-blue-400">
                    {formatCurrency(item.sell_price)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {getSourceBadge(item.source_file)}
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
