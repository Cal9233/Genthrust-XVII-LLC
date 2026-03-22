import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inventoryQuery } from '@/lib/inventory-db'
export const dynamic = 'force-dynamic'

const VALID_CONDITIONS = ['NE', 'OH', 'SV', 'AR', 'FN', 'RP', 'NS']

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      part_number,
      description,
      condition,
      quantity,
      unit_price,
      serial_number,
      warehouse_code,
      certificate_type,
      trace,
    } = body

    // Required field validation
    if (!part_number || typeof part_number !== 'string' || !part_number.trim()) {
      return NextResponse.json({ error: 'Part number is required' }, { status: 400 })
    }
    if (!condition || !VALID_CONDITIONS.includes(condition)) {
      return NextResponse.json(
        { error: `Condition is required and must be one of: ${VALID_CONDITIONS.join(', ')}` },
        { status: 400 }
      )
    }
    if (quantity === undefined || quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 })
    }

    // Optional numeric validation
    if (unit_price !== null && unit_price !== undefined) {
      if (typeof unit_price !== 'number' || unit_price < 0) {
        return NextResponse.json({ error: 'Unit price must be a non-negative number' }, { status: 400 })
      }
    }

    const normalizedPartNumber = part_number.trim().toUpperCase()

    const result = await inventoryQuery<any>(
      `INSERT INTO inventory
         (part_number, description, \`condition\`, quantity, unit_price,
          serial_number, warehouse_code, certificate_type, trace, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        normalizedPartNumber,
        description?.trim() || null,
        condition,
        quantity,
        unit_price ?? null,
        serial_number?.trim() || null,
        warehouse_code?.trim() || null,
        certificate_type?.trim() || null,
        trace?.trim() || null,
      ]
    )

    return NextResponse.json(
      {
        id: result.insertId,
        part_number: normalizedPartNumber,
        description: description?.trim() || null,
        condition,
        quantity,
        unit_price: unit_price ?? null,
        serial_number: serial_number?.trim() || null,
        warehouse_code: warehouse_code?.trim() || null,
        certificate_type: certificate_type?.trim() || null,
        trace: trace?.trim() || null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Add inventory API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    const isConnError = error instanceof Error && (
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.message.includes('connect timeout') || error.message.includes('Connection lost')
    )
    return NextResponse.json(
      { error: isConnError ? 'Inventory database unavailable' : 'Failed to add inventory item' },
      { status: isConnError ? 503 : 500 }
    )
  }
}
