'use client'

import { useMemo } from 'react'
import { CheckCircle2, XCircle, RotateCcw, Package } from 'lucide-react'
import type { BatchSearchResponse, BatchSearchResult } from '@/types/pdf'

interface InventoryMatchResultsProps {
  results: BatchSearchResponse
  onReset: () => void
}

const CONDITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NE: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  OH: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  SV: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  AR: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  FN: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  RP: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  NS: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
}
const DEFAULT_CONDITION = { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }

function ConditionPill({ condition }: { condition: string | null }) {
  const c = condition ? (CONDITION_COLORS[condition] || DEFAULT_CONDITION) : DEFAULT_CONDITION
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {condition || 'N/A'}
    </span>
  )
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined || val === 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export function InventoryMatchResults({ results, onReset }: InventoryMatchResultsProps) {
  const { foundParts, notFoundParts } = useMemo(() => {
    const found: BatchSearchResult[] = []
    const notFound: BatchSearchResult[] = []

    for (const result of Object.values(results.results)) {
      if (result.found) {
        found.push(result)
      } else {
        notFound.push(result)
      }
    }

    // Sort found by total quantity desc, not-found alphabetically
    found.sort((a, b) => b.totalQuantity - a.totalQuantity)
    notFound.sort((a, b) => a.partNumber.localeCompare(b.partNumber))

    return { foundParts: found, notFoundParts: notFound }
  }, [results])

  const foundPct = results.searched > 0
    ? Math.round((results.found / results.searched) * 100)
    : 0

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {results.found} of {results.searched} parts found
          </h3>
          <p className="text-sm text-slate-500">
            {results.found} in stock &middot; {results.notFound} not found
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Start Over
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-red-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${foundPct}%` }}
        />
      </div>

      {/* Found parts section */}
      {foundParts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h4 className="text-sm font-semibold text-green-700">
              Found in Inventory ({foundParts.length})
            </h4>
          </div>
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-50 border-b border-green-200">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Part Number</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Description</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Condition</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-green-700 uppercase tracking-wider">Qty</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Warehouse</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-green-700 uppercase tracking-wider">Price</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-700 uppercase tracking-wider w-16">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-100">
                  {foundParts.map((result) =>
                    result.inventoryMatches.map((match, idx) => (
                      <tr key={`${result.partNumber}-${idx}`} className="bg-white hover:bg-green-50/50 transition-colors">
                        <td className="px-3 py-2 font-medium font-mono text-slate-900">{match.part_number}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">{match.description || '—'}</td>
                        <td className="px-3 py-2"><ConditionPill condition={match.condition} /></td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{match.quantity}</td>
                        <td className="px-3 py-2 text-slate-600">{match.warehouse_code || '—'}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(match.unit_price)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            match.source === 'local'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {match.source === 'local' ? 'DB' : 'ERP'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Not found section */}
      {notFoundParts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold text-red-700">
              Not Found ({notFoundParts.length})
            </h4>
          </div>
          <div className="border border-red-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-red-50/50">
              <div className="flex flex-wrap gap-2">
                {notFoundParts.map((result) => (
                  <span
                    key={result.partNumber}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-xs font-mono font-medium text-red-700"
                  >
                    <Package className="w-3 h-3" />
                    {result.partNumber}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {foundParts.length === 0 && notFoundParts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Package className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">No results returned</p>
          <p className="text-xs mt-1">The search completed but no parts were matched</p>
        </div>
      )}
    </div>
  )
}
