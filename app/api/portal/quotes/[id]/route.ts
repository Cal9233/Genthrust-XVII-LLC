import { type NextRequest } from "next/server";
import { proxyToGenthrust, buildPath } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

// TODO: genthrust-ai must implement GET /api/portal/quotes/:id
// Expected response: { quote: Quote, lineItems: QuoteLineItem[] }
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToGenthrust({ path: buildPath("/api/portal/quotes", id), request });
}
