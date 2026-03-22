/**
 * AI Chat Configuration - Claude/Vercel AI SDK Integration
 * Ported from Genthrust_Repairs_v.2 chat route
 *
 * This module provides the AI tools and system prompt for the GenThrust
 * repair order management assistant. Used by the chat API route.
 */

import { z } from "zod";

// Tool input schemas
export const SearchInventorySchema = z.object({
  query: z
    .string()
    .describe("Part number or description keyword to search for"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results to return (default 20)"),
});

export const GetRepairOrderSchema = z.object({
  roNumber: z
    .number()
    .optional()
    .describe("Repair order number (e.g., 12345)"),
  roId: z.number().optional().describe("Database ID of the repair order"),
});

export const CreateRepairOrderSchema = z.object({
  shopName: z.string().describe("Name of the repair shop"),
  part: z.string().describe("Part number"),
  serial: z.string().optional().describe("Serial number"),
  partDescription: z.string().optional().describe("Description of the part"),
  reqWork: z.string().optional().describe("Requested work/repairs"),
  estimatedCost: z
    .number()
    .optional()
    .describe("Estimated repair cost in USD"),
});

export const UpdateRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to update"),
  fields: z
    .object({
      shopName: z.string().optional(),
      part: z.string().optional(),
      serial: z.string().optional().nullable(),
      partDescription: z.string().optional().nullable(),
      reqWork: z.string().optional().nullable(),
      currentStatus: z.string().optional().describe("New status"),
      currentStatusDate: z.string().optional().nullable(),
      estimatedDeliveryDate: z.string().optional().nullable(),
      dateDroppedOff: z.string().optional().nullable(),
      dateMade: z.string().optional().nullable(),
      lastDateUpdated: z.string().optional().nullable(),
      nextDateToUpdate: z.string().optional().nullable(),
      estimatedCost: z.number().optional().nullable(),
      finalCost: z.number().optional().nullable(),
      terms: z.string().optional().nullable(),
      shopRef: z.string().optional().nullable(),
      trackingNumberPickingUp: z.string().optional().nullable(),
      genthrustStatus: z.string().optional().nullable(),
      shopStatus: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .describe("Fields to update"),
});

export const ArchiveRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to archive"),
  destination: z
    .enum(["returns", "paid", "net"])
    .describe("Destination sheet"),
  reason: z.string().optional().describe("Reason for archiving"),
});

export const CreateEmailDraftSchema = z.object({
  roNumber: z.number().describe("Repair order number"),
  toAddress: z.string().email().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content (HTML supported)"),
});

export const ListRepairOrdersSchema = z.object({
  status: z
    .enum(["overdue", "active", "completed", "all"])
    .optional()
    .describe("Filter by status"),
  shopName: z.string().optional().describe("Filter by shop name"),
  limit: z.number().optional().describe("Maximum results (default 20)"),
});

export const SYSTEM_PROMPT = `You are an AI assistant for GenThrust, an aviation parts and repair tracking company.

Your capabilities:
- Search the inventory database by part number or description
- Look up repair order (RO) details by RO number or database ID
- List and filter repair orders (by status: overdue/active/completed/all, by shop name)
- Create new repair orders
- Update ANY field on existing repair orders (status, shop name, part info, costs, dates, notes, tracking numbers, etc.)
- Update status to ANY valid status - status changes trigger automated follow-ups (calendar events, to-do tasks, email drafts)
- Archive repair orders (move to Returns, Paid, or NET sheets)
- Create email drafts for follow-ups (saved to notification queue for user approval)

Guidelines:
- Be concise and professional
- When presenting inventory results, summarize key details (part number, quantity, location, condition)
- When presenting repair orders, highlight status, shop, part info, and estimated dates
- If no results are found, suggest alternative searches
- Use plain text formatting. Avoid markdown symbols like ##, **, *, -, etc.
- Use bullet points as "•" directly, not "-" or "*"
- When creating or modifying records, confirm the action and show key details
- Email drafts are NOT sent automatically - they are saved to the notification queue for user review
- All changes are automatically synced to the Excel workbook
- Write operations (create, update, archive, email) are queued for background processing
- To "remove" or "delete" a repair order from active tracking, use the archive tool
- Status changes automatically trigger lifecycle automation for tracked statuses`;
