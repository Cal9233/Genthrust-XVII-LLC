'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'

interface LineItem {
  part_number: string
  quantity: string
  condition: string
  notes: string
}

const CONDITIONS = ['New', 'Serviceable', 'Overhauled', 'Inspected', 'As Removed', 'Unserviceable', 'Any']
const URGENCIES = ['Routine', 'Priority', 'Critical', 'AOG']

function emptyLine(): LineItem {
  return { part_number: '', quantity: '1', condition: 'Any', notes: '' }
}

export default function NewQuotePage() {
  const router = useRouter()
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [urgency, setUrgency] = useState('Routine')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof LineItem, value: string) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Validate at least one line with a part number
    const validLines = lines.filter((l) => l.part_number.trim())
    if (validLines.length === 0) {
      setError('Please add at least one part number.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency,
          notes: notes.trim() || null,
          line_items: validLines.map((l) => ({
            part_number: l.part_number.trim(),
            quantity: parseInt(l.quantity, 10) || 1,
            condition: l.condition,
            notes: l.notes.trim() || null,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit quote request')
      }

      router.push('/portal/quotes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quote request')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/portal/quotes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Quotes
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">New Quote Request</h1>
        <p className="text-slate-500 text-sm mt-1">Submit a request for parts pricing. Our team will respond promptly.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-navy-900">Parts Requested</h2>
              <p className="text-xs text-slate-400 mt-0.5">{lines.length} line item{lines.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-navy-700 bg-navy-50 border border-navy-200 rounded-lg hover:bg-navy-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600/30"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Line Item
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {lines.map((line, index) => (
              <div key={index} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Line {index + 1}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor={`pn-${index}`}>
                      Part Number <span className="text-red-500" aria-hidden="true">*</span>
                    </label>
                    <input
                      id={`pn-${index}`}
                      type="text"
                      value={line.part_number}
                      onChange={(e) => updateLine(index, 'part_number', e.target.value)}
                      placeholder="e.g. 65C27254-7"
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-navy-900 font-mono placeholder:font-sans placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor={`qty-${index}`}>
                      Quantity
                    </label>
                    <input
                      id={`qty-${index}`}
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-navy-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor={`cond-${index}`}>
                      Condition
                    </label>
                    <select
                      id={`cond-${index}`}
                      value={line.condition}
                      onChange={(e) => updateLine(index, 'condition', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-navy-900 bg-white"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor={`ln-${index}`}>
                      Line Notes
                    </label>
                    <input
                      id={`ln-${index}`}
                      type="text"
                      value={line.notes}
                      onChange={(e) => updateLine(index, 'notes', e.target.value)}
                      placeholder="Optional: serial number requirement, trace documentation, etc."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-navy-900">Request Details</h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="urgency">
              Urgency
            </label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-navy-900 bg-white"
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {urgency === 'AOG' && (
              <p className="text-xs text-red-600 font-medium mt-1.5">
                AOG requests are prioritized. Our team will contact you as soon as possible.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1" htmlFor="notes">
              Additional Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Provide any additional context, delivery requirements, or special instructions..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-navy-600 text-slate-700 placeholder:text-slate-400 resize-y"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {submitting ? 'Submitting...' : 'Submit Quote Request'}
          </button>
          <Link
            href="/portal/quotes"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
