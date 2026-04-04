import { type NextRequest } from 'next/server'
import { proxyToGenthrust } from '@/lib/api-proxy'

export const dynamic = 'force-dynamic'

// TODO: genthrust-ai must implement GET /api/portal/sales-orders
// Query params: page, limit, status, search
// Expected response: { data: SalesOrder[], total: number, page: number, limit: number }
export async function GET(request: NextRequest) {
  return proxyToGenthrust({ path: '/api/portal/sales-orders', request })
}
