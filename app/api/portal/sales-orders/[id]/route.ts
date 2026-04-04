import { type NextRequest } from "next/server";
import { proxyToGenthrust, buildPath } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

// TODO: genthrust-ai must implement GET /api/portal/sales-orders/:id
// Expected response: { order: SalesOrder, lines: SalesOrderLine[] }
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToGenthrust({ path: buildPath("/api/portal/sales-orders", id), request });
}
