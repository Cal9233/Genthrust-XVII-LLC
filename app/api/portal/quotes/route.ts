import { type NextRequest } from 'next/server'
import { proxyToGenthrust } from '@/lib/api-proxy'

export const dynamic = 'force-dynamic'

// TODO: genthrust-ai must implement GET /api/portal/quotes
// Expected response: { data: Quote[], total: number }
export async function GET(request: NextRequest) {
  return proxyToGenthrust({ path: '/api/portal/quotes', request })
}

// TODO: genthrust-ai must implement POST /api/portal/quotes
// Request body: { line_items: { part_number: string, quantity: number }[] }
// Expected response: { id: number, status: 'pending' } (201)
export async function POST(request: NextRequest) {
  return proxyToGenthrust({ path: '/api/portal/quotes', request, forwardBody: true })
}
