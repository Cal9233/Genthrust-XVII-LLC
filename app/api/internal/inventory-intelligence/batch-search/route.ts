import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
import { searchErpParts } from '@/lib/erp-client'
import type { BatchSearchResponse, BatchSearchResult, InventoryMatch } from '@/types/pdf'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const _role = (session?.user as any)?.role
    if (!session?.user || (_role !== 'internal' && _role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { partNumbers, includeAlts } = body as {
      partNumbers: string[]
      includeAlts?: Record<string, string[]>
    }

    if (!Array.isArray(partNumbers) || partNumbers.length === 0) {
      return NextResponse.json({ error: 'partNumbers array is required' }, { status: 400 })
    }

    // Cap at 500 part numbers to prevent abuse
    if (partNumbers.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 part numbers per request' }, { status: 400 })
    }

    // Build the full set of PNs to search (primary + alts)
    const allPns = new Set<string>()
    const altToPrimary = new Map<string, string>()

    for (const pn of partNumbers) {
      const normalized = pn.toUpperCase().trim()
      allPns.add(normalized)

      // Add alt PNs if provided
      const alts = includeAlts?.[pn] || []
      for (const alt of alts) {
        const normalizedAlt = alt.toUpperCase().trim()
        allPns.add(normalizedAlt)
        altToPrimary.set(normalizedAlt, normalized)
      }
    }

    const pnArray = Array.from(allPns)

    // Initialize results for each primary PN
    const results: Record<string, BatchSearchResult> = {}
    for (const pn of partNumbers) {
      const normalized = pn.toUpperCase().trim()
      results[normalized] = {
        partNumber: normalized,
        found: false,
        inventoryMatches: [],
        totalQuantity: 0,
      }
    }

    // Step 1: Query local inventory database
    if (pnArray.length > 0) {
      const placeholders = pnArray.map(() => '?').join(', ')
      const sql = `
        SELECT part_number, description, \`condition\`, quantity,
               warehouse_code, unit_price, serial_number
        FROM inventory
        WHERE UPPER(part_number) IN (${placeholders})
        ORDER BY part_number
      `
      try {
        const localResults = await inventoryQuery<any[]>(sql, pnArray)

        for (const row of localResults) {
          const matchedPn = (row.part_number || '').toUpperCase()
          // Determine which primary PN this match belongs to
          const primaryPn = altToPrimary.get(matchedPn) || matchedPn

          if (results[primaryPn]) {
            const match: InventoryMatch = {
              part_number: row.part_number,
              description: row.description || null,
              condition: row.condition || null,
              quantity: row.quantity || 0,
              warehouse_code: row.warehouse_code || null,
              unit_price: row.unit_price || null,
              serial_number: row.serial_number || null,
              source: 'local',
            }
            results[primaryPn].inventoryMatches.push(match)
            results[primaryPn].totalQuantity += match.quantity
            results[primaryPn].found = true
          }
        }
      } catch (err) {
        console.error('Local inventory batch search error:', err)
      }
    }

    // Step 2: For parts NOT found locally, try ERP AERO
    const notFoundPns = Object.values(results)
      .filter(r => !r.found)
      .map(r => r.partNumber)

    if (notFoundPns.length > 0) {
      // Chunk into batches of 5 to avoid rate limiting
      const chunks: string[][] = []
      for (let i = 0; i < notFoundPns.length; i += 5) {
        chunks.push(notFoundPns.slice(i, i + 5))
      }

      for (const chunk of chunks) {
        const erpPromises = chunk.map(async (pn) => {
          try {
            const erpResult = await searchErpParts(pn)
            if (erpResult.parts.length > 0) {
              // Filter for exact PN match
              const exactMatches = erpResult.parts.filter(
                (p: any) => (p.part_number || '').toUpperCase() === pn
              )

              for (const part of exactMatches) {
                const match: InventoryMatch = {
                  part_number: part.part_number,
                  description: part.description || null,
                  condition: part.condition || null,
                  quantity: part.quantity || 0,
                  warehouse_code: part.warehouse || null,
                  unit_price: part.unit_price || null,
                  serial_number: part.serial_number || null,
                  source: 'erp',
                }
                results[pn].inventoryMatches.push(match)
                results[pn].totalQuantity += match.quantity
                results[pn].found = true
              }
            }
          } catch (err) {
            console.error(`ERP search error for ${pn}:`, err)
          }
        })

        await Promise.all(erpPromises)
      }

      // Also check alts of not-found parts in ERP
      for (const pn of notFoundPns) {
        if (results[pn].found) continue

        const alts = includeAlts?.[pn] || []
        for (const alt of alts) {
          if (results[pn].found) break
          try {
            const erpResult = await searchErpParts(alt)
            const exactMatches = erpResult.parts.filter(
              (p: any) => (p.part_number || '').toUpperCase() === alt.toUpperCase()
            )
            for (const part of exactMatches) {
              const match: InventoryMatch = {
                part_number: part.part_number,
                description: part.description || null,
                condition: part.condition || null,
                quantity: part.quantity || 0,
                warehouse_code: part.warehouse || null,
                unit_price: part.unit_price || null,
                serial_number: part.serial_number || null,
                source: 'erp',
              }
              results[pn].inventoryMatches.push(match)
              results[pn].totalQuantity += match.quantity
              results[pn].found = true
            }
          } catch {
            // Skip failed alt lookups
          }
        }
      }
    }

    const foundCount = Object.values(results).filter(r => r.found).length

    const response: BatchSearchResponse = {
      searched: partNumbers.length,
      found: foundCount,
      notFound: partNumbers.length - foundCount,
      results,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Batch search failed:', error)
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('Connection lost') ||
      error.message.includes('AbortError') || error.message.includes('timeout')
    )
    return NextResponse.json(
      { error: isConnError ? 'Service unavailable' : 'Batch search failed' },
      { status: isConnError ? 503 : 500 }
    )
  }
}
