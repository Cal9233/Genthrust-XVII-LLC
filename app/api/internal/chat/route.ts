/**
 * AI Chat API Route - Claude-powered repair order assistant
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db/index";
import { active, inventoryindex } from "@/lib/db/schema";
import { and, eq, inArray, like, lte, or, sql } from "drizzle-orm";
import { isOverdue, daysSince } from "@/lib/date-utils";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from "@/lib/audit-logger";
import { query } from "@/lib/db";
import { inventoryQuery } from "@/lib/inventory-db";
import {
  SearchInventorySchema,
  GetRepairOrderSchema,
  CreateRepairOrderSchema,
  UpdateRepairOrderSchema,
  ArchiveRepairOrderSchema,
  CreateEmailDraftSchema,
  ListRepairOrdersSchema,
  SYSTEM_PROMPT,
} from "@/lib/ai/chat";

type DbRow = Record<string, unknown>

async function buildLiveContext(): Promise<string> {
  const results = await Promise.allSettled([
    // Inventory count from inventory DB
    inventoryQuery<DbRow[]>('SELECT COUNT(*) as totalSkus FROM inventory'),
    // ERP summary from main DB
    query<DbRow[]>(`SELECT
      (SELECT COUNT(*) FROM repair_orders WHERE status NOT IN ('Closed','Cancelled','Completed') OR status IS NULL) as activeROs,
      (SELECT COUNT(*) FROM sales_orders WHERE status NOT IN ('Closed','Cancelled','Completed') OR status IS NULL) as activeSOs,
      (SELECT COUNT(*) FROM invoices WHERE status NOT IN ('Paid','Closed','Cancelled') OR status IS NULL) as openInvoices,
      (SELECT COALESCE(SUM(open_balance),0) FROM invoices WHERE status NOT IN ('Paid','Closed','Cancelled') OR status IS NULL) as openBalance`),
    // Client count
    query<DbRow[]>(`SELECT COUNT(*) as totalClients, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as activeClients FROM portal_users`),
  ])

  const lines: string[] = ['[LIVE BUSINESS CONTEXT]']

  if (results[0].status === 'fulfilled') {
    const row = results[0].value[0] || {}
    lines.push(`Inventory: ${row.totalSkus ?? 'N/A'} SKUs in stock`)
  }

  if (results[1].status === 'fulfilled') {
    const row = results[1].value[0] || {}
    lines.push(`ERP: ${row.activeROs ?? 'N/A'} open repair orders, ${row.activeSOs ?? 'N/A'} open sales orders, ${row.openInvoices ?? 'N/A'} open invoices ($${Number(row.openBalance ?? 0).toFixed(2)} outstanding)`)
  }

  if (results[2].status === 'fulfilled') {
    const row = results[2].value[0] || {}
    lines.push(`Clients: ${row.totalClients ?? 'N/A'} total portal users (${row.activeClients ?? 'N/A'} active)`)
  }

  lines.push('[END CONTEXT]')
  return lines.join('\n')
}

export const maxDuration = 60;

const chatLimiter = createRateLimiter({ maxAttempts: 20, windowMs: 60 * 1000, name: 'ai-chat' });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  if ((session.user as any).role !== "internal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = session.user.id;

  // Rate limit: max 20 requests per minute per user
  const rl = await chatLimiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  await chatLimiter.record(userId);

  const body = await req.json();

  // Validate messages array structure
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }
  if (body.messages.length > 100) {
    return NextResponse.json({ error: "Too many messages in conversation" }, { status: 400 });
  }

  const { messages } = body;
  const modelMessages = convertToModelMessages(messages);

  // Audit: log AI chat invocation (fire-and-forget)
  logAuditEvent({
    action: ACTION_TYPES.AI_CHAT,
    resource_type: RESOURCE_TYPES.CHAT,
    user_id: userId,
    user_email: session.user.email ?? null,
    user_role: 'internal',
    success: true,
    metadata: { messageCount: messages?.length ?? 0 },
  }).catch(() => {});

  // Fetch live business context to inject into system prompt
  let liveContext = ''
  try {
    liveContext = await buildLiveContext()
  } catch {
    // Non-fatal: proceed without context if DB is unavailable
  }

  const systemPrompt = liveContext
    ? `${SYSTEM_PROMPT}\n\n${liveContext}`
    : SYSTEM_PROMPT

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxOutputTokens: 2048,
    stopWhen: stepCountIs(10),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      // READ TOOLS - Direct DB (fast, inline)
      search_inventory: {
        description:
          "Search the inventory index by part number or description.",
        inputSchema: SearchInventorySchema,
        execute: async ({
          query,
          limit = 20,
        }: z.infer<typeof SearchInventorySchema>) => {
          const pattern = `%${query}%`;
          const results = await db
            .select()
            .from(inventoryindex)
            .where(
              or(
                like(inventoryindex.partNumber, pattern),
                like(inventoryindex.description, pattern)
              )
            )
            .limit(limit ?? 20);

          return { items: results, count: results.length };
        },
      },

      get_repair_order: {
        description: "Look up repair order details by RO number or database ID.",
        inputSchema: GetRepairOrderSchema,
        execute: async ({
          roNumber,
          roId,
        }: z.infer<typeof GetRepairOrderSchema>) => {
          let results;
          if (roId) {
            results = await db
              .select()
              .from(active)
              .where(eq(active.id, roId));
          } else if (roNumber) {
            results = await db
              .select()
              .from(active)
              .where(eq(active.ro, roNumber));
          } else {
            return { repairOrder: null, error: "Must provide roNumber or roId" };
          }
          return { repairOrder: results[0] ?? null };
        },
      },

      list_repair_orders: {
        description:
          "List repair orders with optional filters by status and shop name.",
        inputSchema: ListRepairOrdersSchema,
        execute: async ({
          status = "all",
          shopName,
          limit = 20,
        }: z.infer<typeof ListRepairOrdersSchema>) => {
          const INCOMPLETE_STATUSES = [
            "WAITING QUOTE",
            "APPROVED",
            "IN WORK",
            "IN PROGRESS",
            "SHIPPED",
            "IN TRANSIT",
            "PENDING",
          ];
          const COMPLETE_STATUSES = [
            "COMPLETE",
            "RETURNED",
            "PAID",
            "NET",
          ];

          // Build WHERE conditions and push all filters to SQL — no JS post-filtering
          const conditions = [];

          if (shopName) {
            conditions.push(like(active.shopName, `%${shopName}%`));
          }

          if (status === "overdue") {
            conditions.push(
              inArray(active.currentStatus, INCOMPLETE_STATUSES),
              lte(active.estimatedDeliveryDate, sql`DATE_SUB(NOW(), INTERVAL 1 DAY)`)
            );
          } else if (status === "active") {
            conditions.push(inArray(active.currentStatus, INCOMPLETE_STATUSES));
          } else if (status === "completed") {
            conditions.push(inArray(active.currentStatus, COMPLETE_STATUSES));
          }
          // status === "all": no status condition

          const filteredROs = await db
            .select()
            .from(active)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(active.estimatedDeliveryDate)
            .limit(limit);

          const results = filteredROs
            .map((ro) => ({
              id: ro.id,
              roNumber: ro.ro,
              shopName: ro.shopName,
              part: ro.part,
              serial: ro.serial,
              status: ro.currentStatus,
              estimatedDeliveryDate: ro.estimatedDeliveryDate,
              daysOverdue: isOverdue(ro.estimatedDeliveryDate)
                ? daysSince(ro.estimatedDeliveryDate) || 0
                : 0,
              nextFollowUp: ro.nextDateToUpdate,
            }))
            .sort((a, b) => b.daysOverdue - a.daysOverdue);

          if (results.length === 0) {
            return `No repair orders found matching filter: ${status}${shopName ? `, shop: "${shopName}"` : ""}`;
          }

          const header = `Found ${filteredROs.length} repair orders (showing ${results.length}):\n\n`;
          const list = results
            .map(
              (ro, i) =>
                `${i + 1}. RO #${ro.roNumber} - ${ro.shopName}\n` +
                `   Part: ${ro.part}${ro.serial ? ` (S/N: ${ro.serial})` : ""} | Status: ${ro.status}\n` +
                `   ${ro.daysOverdue > 0 ? `${ro.daysOverdue} days overdue` : "On track"}`
            )
            .join("\n\n");

          return header + list;
        },
      },

      // WRITE TOOLS - Fire-and-forget to Trigger.dev
      create_repair_order: {
        description: "Create a new repair order.",
        inputSchema: CreateRepairOrderSchema,
        execute: async (
          params: z.infer<typeof CreateRepairOrderSchema>
        ) => {
          await tasks.trigger("ai-tool-create-repair-order", {
            userId,
            ...params,
          });
          revalidatePath("/internal");
          return `Queued: Creating RO for ${params.part} at ${params.shopName}.`;
        },
      },

      update_repair_order: {
        description: "Update fields on an existing repair order.",
        inputSchema: UpdateRepairOrderSchema,
        execute: async ({
          roNumber,
          fields,
        }: z.infer<typeof UpdateRepairOrderSchema>) => {
          await tasks.trigger("ai-tool-update-repair-order", {
            userId,
            roNumber,
            fields,
          });
          revalidatePath("/internal");
          const changedFields = Object.keys(fields)
            .filter(
              (k) => fields[k as keyof typeof fields] !== undefined
            )
            .join(", ");
          return `Queued: Updating RO #${roNumber} (${changedFields}).`;
        },
      },

      archive_repair_order: {
        description: "Archive a repair order to Returns, Paid, or NET sheet.",
        inputSchema: ArchiveRepairOrderSchema,
        execute: async ({
          roNumber,
          destination,
          reason,
        }: z.infer<typeof ArchiveRepairOrderSchema>) => {
          await tasks.trigger("ai-tool-archive-repair-order", {
            userId,
            roNumber,
            destination,
            reason,
          });
          revalidatePath("/internal");
          const sheetNames: Record<string, string> = {
            returns: "Returns",
            paid: "Paid",
            net: "NET",
          };
          return `Queued: Moving RO #${roNumber} to ${sheetNames[destination]} sheet.`;
        },
      },

      create_email_draft: {
        description:
          "Create an email draft for a repair order (saved to notification queue).",
        inputSchema: CreateEmailDraftSchema,
        execute: async ({
          roNumber,
          toAddress,
          subject,
          body,
        }: z.infer<typeof CreateEmailDraftSchema>) => {
          await tasks.trigger("ai-tool-create-email-draft", {
            userId,
            roNumber,
            toAddress,
            subject,
            body,
          });
          revalidatePath("/internal");
          return `Queued: Creating email draft for RO #${roNumber} to ${toAddress}.`;
        },
      },
    },
  });

  return result.toTextStreamResponse();
}
