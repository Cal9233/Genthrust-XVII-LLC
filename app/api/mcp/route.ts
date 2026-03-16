/**
 * MCP HTTP Endpoint — Genthrust Hub
 * ===================================
 * Exposes the website's MySQL database operations as MCP tools over HTTP.
 * Uses @vercel/mcp-adapter for Next.js App Router integration.
 *
 * Auth: Bearer token check via MCP_API_KEY env var.
 * Transport: Streamable HTTP (no Redis needed for local dev).
 *
 * Tools:
 *   - get_dashboard_stats: Parts count, RO/SO/invoice totals
 *   - search_parts: Search 500K+ parts catalog
 *   - search_repair_orders: Search ROs by query and optional status
 *   - search_sales_orders: Search SOs by query and optional status
 *   - search_invoices: Search invoices
 *   - get_repair_order: RO detail with line items
 *   - get_sales_order: SO detail with line items
 *   - get_invoice: Invoice detail with line items
 *   - list_companies: Company search
 *   - get_client_orders: Orders filtered by company
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import createMcpHandler from "@vercel/mcp-adapter/next";
import { z } from "zod";
import { query } from "@/lib/db";
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function checkAuth(request: Request): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    // No key configured — fail closed. MCP_API_KEY is required.
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  // Proper Bearer parsing: split on first space only
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) return false;

  const token = parts[1];

  // Timing-safe comparison to prevent timing attacks
  try {
    const tokenBuf = Buffer.from(token, "utf-8");
    const keyBuf = Buffer.from(apiKey, "utf-8");
    if (tokenBuf.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, keyBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function safeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    return await query<T[]>(sql, params);
  } catch {
    return [];
  }
}

async function safeCount(
  sql: string,
  params?: any[]
): Promise<Record<string, any>> {
  try {
    const rows = await query<any[]>(sql, params);
    return rows[0] || {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// MCP Route Handler
// ---------------------------------------------------------------------------

const handler = createMcpHandler(
  (server) => {
    // --- get_dashboard_stats ---
    server.tool(
      "get_dashboard_stats",
      "Get dashboard statistics: parts count, active ROs/SOs, open invoices, pending quotes",
      {},
      async () => {
        const [parts, ros, sos, invoices, quotes, companies] =
          await Promise.all([
            safeCount("SELECT COUNT(*) as total FROM parts"),
            safeCount(
              `SELECT COUNT(*) as active FROM repair_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`
            ),
            safeCount(
              `SELECT COUNT(*) as active FROM sales_orders WHERE status NOT IN ('Closed', 'Cancelled', 'Completed') OR status IS NULL`
            ),
            safeCount(
              `SELECT COUNT(*) as open_count, COALESCE(SUM(open_balance), 0) as open_balance FROM invoices WHERE status NOT IN ('Paid', 'Closed', 'Cancelled') OR status IS NULL`
            ),
            safeCount(
              `SELECT COUNT(*) as pending FROM quotes WHERE stage NOT IN ('Closed', 'Won', 'Lost') OR stage IS NULL`
            ),
            safeCount("SELECT COUNT(*) as total FROM companies"),
          ]);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  totalParts: parts.total || 0,
                  activeRepairOrders: ros.active || 0,
                  activeSalesOrders: sos.active || 0,
                  openInvoices: invoices.open_count || 0,
                  openBalance: parseFloat(invoices.open_balance) || 0,
                  pendingQuotes: quotes.pending || 0,
                  totalCompanies: companies.total || 0,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- search_parts ---
    server.tool(
      "search_parts",
      "Search the parts catalog by part number, description, or keyword",
      {
        query: z.string().describe("Search term (part number or description)"),
        limit: z
          .number()
          .optional()
          .default(25)
          .describe("Max results (default 25, max 100)"),
      },
      async ({ query: q, limit }) => {
        const lim = Math.min(limit || 25, 100);
        const search = `%${q}%`;
        const results = await safeQuery(
          `SELECT id, part_number, description, condition_code, quantity, unit_price, warehouse_code
           FROM parts
           WHERE part_number LIKE ? OR description LIKE ?
           ORDER BY part_number
           LIMIT ?`,
          [search, search, lim]
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: results.length, parts: results },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- search_repair_orders ---
    server.tool(
      "search_repair_orders",
      "Search repair orders by RO number, vendor name, or keyword. Optionally filter by status.",
      {
        query: z.string().describe("Search term"),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status (e.g. 'Open', 'In Progress', 'Received')"
          ),
        limit: z.number().optional().default(25),
      },
      async ({ query: q, status, limit }) => {
        const lim = Math.min(limit || 25, 100);
        const search = `%${q}%`;

        let sql = `SELECT id, erp_po_id, ro_number, vendor_name, status, priority, due_date, total, erp_created_at, erp_modified_at
                    FROM repair_orders
                    WHERE (ro_number LIKE ? OR vendor_name LIKE ?)`;
        const params: any[] = [search, search];

        if (status) {
          sql += ` AND status = ?`;
          params.push(status);
        }
        sql += ` ORDER BY erp_modified_at DESC LIMIT ?`;
        params.push(lim);

        const results = await safeQuery(sql, params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: results.length, repair_orders: results },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- search_sales_orders ---
    server.tool(
      "search_sales_orders",
      "Search sales orders by SO number, customer name, or keyword. Optionally filter by status.",
      {
        query: z.string().describe("Search term"),
        status: z.string().optional().describe("Filter by status"),
        limit: z.number().optional().default(25),
      },
      async ({ query: q, status, limit }) => {
        const lim = Math.min(limit || 25, 100);
        const search = `%${q}%`;

        let sql = `SELECT id, erp_so_id, so_number, customer_po, customer_name, status, priority, due_date, total, erp_created_at
                    FROM sales_orders
                    WHERE (so_number LIKE ? OR customer_name LIKE ? OR customer_po LIKE ?)`;
        const params: any[] = [search, search, search];

        if (status) {
          sql += ` AND status = ?`;
          params.push(status);
        }
        sql += ` ORDER BY erp_modified_at DESC LIMIT ?`;
        params.push(lim);

        const results = await safeQuery(sql, params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: results.length, sales_orders: results },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- search_invoices ---
    server.tool(
      "search_invoices",
      "Search invoices by invoice number, account name, or keyword",
      {
        query: z.string().describe("Search term"),
        limit: z.number().optional().default(25),
      },
      async ({ query: q, limit }) => {
        const lim = Math.min(limit || 25, 100);
        const search = `%${q}%`;
        const results = await safeQuery(
          `SELECT id, erp_invoice_id, invoice_no, account_name, status, due_date, invoice_date, total, open_balance
           FROM invoices
           WHERE invoice_no LIKE ? OR account_name LIKE ?
           ORDER BY erp_modified_at DESC
           LIMIT ?`,
          [search, search, lim]
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: results.length, invoices: results },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- get_repair_order ---
    server.tool(
      "get_repair_order",
      "Get detailed information about a specific repair order including line items",
      {
        id: z.number().describe("Repair order database ID"),
      },
      async ({ id }) => {
        const [ro] = await safeQuery(
          `SELECT * FROM repair_orders WHERE id = ?`,
          [id]
        );
        if (!ro) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Repair order not found" }),
              },
            ],
          };
        }

        const lines = await safeQuery(
          `SELECT * FROM repair_order_lines WHERE repair_order_id = ?`,
          [id]
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { repair_order: ro, lines: lines },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- get_sales_order ---
    server.tool(
      "get_sales_order",
      "Get detailed information about a specific sales order including line items",
      {
        id: z.number().describe("Sales order database ID"),
      },
      async ({ id }) => {
        const [so] = await safeQuery(
          `SELECT * FROM sales_orders WHERE id = ?`,
          [id]
        );
        if (!so) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Sales order not found" }),
              },
            ],
          };
        }

        const lines = await safeQuery(
          `SELECT * FROM sales_order_lines WHERE sales_order_id = ?`,
          [id]
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { sales_order: so, lines: lines },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- get_invoice ---
    server.tool(
      "get_invoice",
      "Get detailed information about a specific invoice including line items",
      {
        id: z.number().describe("Invoice database ID"),
      },
      async ({ id }) => {
        const [inv] = await safeQuery(
          `SELECT * FROM invoices WHERE id = ?`,
          [id]
        );
        if (!inv) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Invoice not found" }),
              },
            ],
          };
        }

        const lines = await safeQuery(
          `SELECT * FROM invoice_lines WHERE invoice_id = ?`,
          [id]
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { invoice: inv, lines: lines },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- list_companies ---
    server.tool(
      "list_companies",
      "Search companies by name",
      {
        query: z
          .string()
          .optional()
          .default("")
          .describe("Company name search term (empty = list all)"),
        limit: z.number().optional().default(25),
      },
      async ({ query: q, limit }) => {
        const lim = Math.min(limit || 25, 100);

        let results;
        if (q) {
          const search = `%${q}%`;
          results = await safeQuery(
            `SELECT id, company_name, city, state, country, phone, email
             FROM companies
             WHERE company_name LIKE ?
             ORDER BY company_name
             LIMIT ?`,
            [search, lim]
          );
        } else {
          results = await safeQuery(
            `SELECT id, company_name, city, state, country, phone, email
             FROM companies
             ORDER BY company_name
             LIMIT ?`,
            [lim]
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { count: results.length, companies: results },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // --- get_client_orders ---
    server.tool(
      "get_client_orders",
      "Get all orders (ROs, SOs, invoices) for a specific company",
      {
        company_name: z.string().describe("Company name to filter by"),
      },
      async ({ company_name }) => {
        const search = `%${company_name}%`;
        const [ros, sos, invoices] = await Promise.all([
          safeQuery(
            `SELECT id, ro_number, vendor_name, status, total, erp_created_at
             FROM repair_orders
             WHERE vendor_name LIKE ?
             ORDER BY erp_modified_at DESC
             LIMIT 50`,
            [search]
          ),
          safeQuery(
            `SELECT id, so_number, customer_name, status, total, erp_created_at
             FROM sales_orders
             WHERE customer_name LIKE ?
             ORDER BY erp_modified_at DESC
             LIMIT 50`,
            [search]
          ),
          safeQuery(
            `SELECT id, invoice_no, account_name, status, total, open_balance, due_date
             FROM invoices
             WHERE account_name LIKE ?
             ORDER BY erp_modified_at DESC
             LIMIT 50`,
            [search]
          ),
        ]);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  company: company_name,
                  repair_orders: { count: ros.length, items: ros },
                  sales_orders: { count: sos.length, items: sos },
                  invoices: { count: invoices.length, items: invoices },
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {},
    instructions:
      "Genthrust Hub MCP server — query the aviation brokerage database for parts, repair orders, sales orders, invoices, and companies.",
  },
  {
    streamableHttpEndpoint: "/api/mcp",
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

// ---------------------------------------------------------------------------
// Next.js App Router exports with auth wrapper
// ---------------------------------------------------------------------------

async function withAuth(
  request: Request,
  handler: (request: Request) => Promise<Response>
): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized — provide a valid Bearer token" },
      { status: 401 }
    );
  }
  return handler(request);
}

export async function GET(request: NextRequest) {
  return withAuth(request, handler);
}

export async function POST(request: NextRequest) {
  return withAuth(request, handler);
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, handler);
}
