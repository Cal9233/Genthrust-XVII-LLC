/**
 * Move RO Sheet Task - Moves repair order between Excel sheets
 * Ported from Genthrust_Repairs_v.2
 */

import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { active } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
} from "@/lib/graph/index";
import { dbRowToExcelRow } from "@/lib/graph/excel-mapping";
import { findRowsByRO, getNextAvailableRow } from "@/lib/graph/excel-search";
import {
  executeBatch,
  buildUpdateRowRequest,
  buildDeleteRowRequest,
  analyzeBatchResponse,
  hasRateLimitError,
} from "@/lib/graph/batch";
import { UserNotConnectedError } from "@/lib/types/graph";

export const moveRoSheetPayloadSchema = z.object({
  userId: z.string(),
  roId: z.number(),
  fromSheet: z.string(),
  toSheet: z.string(),
});

export type MoveRoSheetPayload = z.infer<typeof moveRoSheetPayloadSchema>;

const getWorkbookId = () => process.env.EXCEL_WORKBOOK_ID;

export const moveRoSheet = task({
  id: "move-ro-sheet",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 3 },
  run: async (payload: MoveRoSheetPayload) => {
    const { userId, roId, fromSheet, toSheet } = payload;
    const WORKBOOK_ID = getWorkbookId();
    if (!WORKBOOK_ID) throw new Error("EXCEL_WORKBOOK_ID not set");

    let sessionId: string | null = null;

    try {
      let client;
      try {
        client = await getGraphClient(userId);
      } catch (error) {
        if (error instanceof UserNotConnectedError) {
          return { success: false, roNumber: null, fromSheet, toSheet, fromRow: null, toRow: null, error: error.message };
        }
        throw error;
      }

      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;

      const [repairOrder] = await db.select().from(active).where(eq(active.id, roId)).limit(1);
      if (!repairOrder) {
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return { success: false, roNumber: null, fromSheet, toSheet, fromRow: null, toRow: null, error: `RO ID ${roId} not found` };
      }

      const roNumber = repairOrder.ro;

      // Step A: Find row in source
      let fromRowNumber: number | null = null;
      if (roNumber !== null) {
        const existingRows = await findRowsByRO(client, WORKBOOK_ID, fromSheet, sessionId, [roNumber]);
        fromRowNumber = existingRows.get(roNumber) ?? null;
      }

      // Step B: Add to destination
      const toRowNumber = await getNextAvailableRow(client, WORKBOOK_ID, toSheet, sessionId);
      const values = dbRowToExcelRow(repairOrder);

      const addRequest = buildUpdateRowRequest("add-row", WORKBOOK_ID, toSheet, toRowNumber, values);
      const addResponse = await executeBatch(client, [addRequest], sessionId);

      if (hasRateLimitError(addResponse)) throw new Error("Rate limited");

      const addAnalysis = analyzeBatchResponse(addResponse);
      if (addAnalysis.failed > 0) {
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return { success: false, roNumber, fromSheet, toSheet, fromRow: fromRowNumber, toRow: null, error: addAnalysis.errors.join(", ") };
      }

      // Step C: Delete from source (only if add succeeded)
      if (fromRowNumber !== null) {
        const deleteRequest = buildDeleteRowRequest("delete-row", WORKBOOK_ID, fromSheet, fromRowNumber);
        const deleteResponse = await executeBatch(client, [deleteRequest], sessionId);
        if (hasRateLimitError(deleteResponse)) throw new Error("Rate limited during delete");
      }

      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null;

      return { success: true, roNumber, fromSheet, toSheet, fromRow: fromRowNumber, toRow: toRowNumber };
    } catch (error) {
      if (sessionId) {
        try {
          const client = await getGraphClient(userId);
          await closeExcelSession(client, getWorkbookId()!, sessionId);
        } catch {}
      }
      throw error;
    }
  },
});
