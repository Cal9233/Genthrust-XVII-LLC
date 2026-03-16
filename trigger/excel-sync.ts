/**
 * Excel Sync Task - Syncs MySQL repair orders to Excel via Graph API
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { active } from "@/lib/db/schema";
import { inArray, and, notInArray } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
  chunkArray,
} from "@/lib/graph/index";
import { dbRowToExcelRow } from "@/lib/graph/excel-mapping";
import { findRowsByRO, getNextAvailableRow } from "@/lib/graph/excel-search";
import {
  executeBatch,
  buildBatchUpdateRequests,
  analyzeBatchResponse,
  hasRateLimitError,
} from "@/lib/graph/batch";
import { UserNotConnectedError } from "@/lib/types/graph";

export const syncRepairOrdersPayloadSchema = z.object({
  userId: z.string(),
  repairOrderIds: z.array(z.number()),
});

export type SyncRepairOrdersPayload = z.infer<typeof syncRepairOrdersPayloadSchema>;

const WORKBOOK_ID = process.env.EXCEL_WORKBOOK_ID;
const WORKSHEET_NAME = process.env.EXCEL_WORKSHEET_NAME ?? "Active";

export const syncRepairOrders = task({
  id: "sync-repair-orders",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 3 },
  run: async (payload: SyncRepairOrdersPayload) => {
    const { userId, repairOrderIds } = payload;
    const totalItems = repairOrderIds.length;

    logger.info("Starting Excel sync...", { userId, totalItems });
    await metadata.set("progress", 0);
    await metadata.set("status", "starting");

    if (!WORKBOOK_ID) {
      throw new Error("EXCEL_WORKBOOK_ID environment variable is not set");
    }

    let sessionId: string | null = null;
    let rowsUpdated = 0;
    let rowsAdded = 0;
    const errors: string[] = [];

    try {
      await metadata.set("status", "initializing");
      let client;
      try {
        client = await getGraphClient(userId);
      } catch (error) {
        if (error instanceof UserNotConnectedError) {
          return { syncedCount: 0, failedCount: totalItems, rowsUpdated: 0, rowsAdded: 0, errors: [error.message] };
        }
        throw error;
      }

      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;
      await metadata.set("progress", 10);

      // Exclude archived statuses to prevent zombie rows
      const ARCHIVED_STATUSES = ["COMPLETE", "NET", "PAID", "RETURNS", "BER", "RAI", "CANCELLED"];

      const repairOrders = await db
        .select()
        .from(active)
        .where(
          and(
            inArray(active.id, repairOrderIds),
            notInArray(active.currentStatus, [...ARCHIVED_STATUSES])
          )
        );

      if (repairOrders.length === 0) {
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return { syncedCount: 0, failedCount: 0, rowsUpdated: 0, rowsAdded: 0 };
      }

      const roNumbers = repairOrders.filter((ro) => ro.ro !== null).map((ro) => ro.ro as number);
      const existingRows = await findRowsByRO(client, WORKBOOK_ID, WORKSHEET_NAME, sessionId, roNumbers);
      let nextRow = await getNextAvailableRow(client, WORKBOOK_ID, WORKSHEET_NAME, sessionId);

      await metadata.set("progress", 15);
      await metadata.set("status", "processing");

      const chunks = chunkArray(repairOrders, 20);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const updates: Array<{ rowNumber: number; values: (string | number | null)[] }> = [];

        for (const order of chunk) {
          const values = dbRowToExcelRow(order);
          if (order.ro !== null && existingRows.has(order.ro)) {
            updates.push({ rowNumber: existingRows.get(order.ro)!, values });
            rowsUpdated++;
          } else {
            updates.push({ rowNumber: nextRow, values });
            nextRow++;
            rowsAdded++;
          }
        }

        const requests = buildBatchUpdateRequests(WORKBOOK_ID, WORKSHEET_NAME, updates);
        const response = await executeBatch(client, requests, sessionId);
        const analysis = analyzeBatchResponse(response);

        if (hasRateLimitError(response)) {
          throw new Error("Rate limited by Microsoft Graph API");
        }

        if (analysis.errors.length > 0) {
          errors.push(...analysis.errors);
        }

        const progress = Math.round(15 + ((chunkIndex + 1) / chunks.length) * 75);
        await metadata.set("progress", Math.min(progress, 90));
      }

      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null;
      await metadata.set("progress", 100);
      await metadata.set("status", "completed");

      return { syncedCount: rowsUpdated + rowsAdded, failedCount: errors.length, rowsUpdated, rowsAdded, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      if (sessionId) {
        try {
          const client = await getGraphClient(userId);
          await closeExcelSession(client, WORKBOOK_ID!, sessionId);
        } catch {}
      }
      throw error;
    }
  },
});
