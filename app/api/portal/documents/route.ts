import { type NextRequest } from "next/server";
import { proxyToGenthrust } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

// TODO: genthrust-ai must implement GET /api/portal/documents
// Query params: type (optional document type filter)
// Expected response: { documents: Document[] }
export async function GET(request: NextRequest) {
  return proxyToGenthrust({ path: "/api/portal/documents", request });
}
