import { type NextRequest } from "next/server";
import { proxyToGenthrust } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

// TODO: genthrust-ai must implement GET /api/portal/dashboard
// Expected response: { companyName, stats: { activeSOs, openInvoices, openBalance, activeROs },
//   recentSalesOrders, recentInvoices, recentRepairOrders }
export async function GET(request: NextRequest) {
  return proxyToGenthrust({ path: "/api/portal/dashboard", request });
}
