/**
 * Import from Excel - Reads all sheets and imports to respective MySQL tables
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { task, metadata, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { active, net, paid, returns, notificationQueue } from "@/lib/db/schema";
import { eq, notInArray, isNull, inArray, and, isNotNull } from "drizzle-orm";
import {
  getGraphClient,
  createExcelSession,
  closeExcelSession,
} from "@/lib/graph/index";
import {
  excelRowToDbRowForTable,
  type SheetTableName,
  type AnyDbInsertRow,
} from "@/lib/graph/excel-mapping";
import { readAllRows } from "@/lib/graph/excel-search";
import { UserNotConnectedError } from "@/lib/types/graph";

const WORKBOOK_ID = process.env.EXCEL_WORKBOOK_ID;
const TARGET_SHEETS: SheetTableName[] = ["Active", "Net", "Paid", "Returns"];

const SHEET_TO_TABLE = {
  Active: active,
  Net: net,
  Paid: paid,
  Returns: returns,
} as const;

export const importFromExcel = task({
  id: "import-from-excel",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 3 },
  run: async (payload: { userId: string }) => {
    const { userId } = payload;
    if (!WORKBOOK_ID) throw new Error("EXCEL_WORKBOOK_ID not set");

    let sessionId: string | null = null;
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const rowsBySheet: Record<SheetTableName, { rowNumber: number; data: AnyDbInsertRow }[]> = {
      Active: [], Net: [], Paid: [], Returns: [],
    };

    try {
      let client;
      try {
        client = await getGraphClient(userId);
      } catch (error) {
        if (error instanceof UserNotConnectedError) {
          return { totalRows: 0, insertedCount: 0, updatedCount: 0, deletedCount: 0, skippedCount: 0, errorCount: 1, errors: [error.message] };
        }
        throw error;
      }

      const session = await createExcelSession(client, WORKBOOK_ID);
      sessionId = session.id;

      // Read all sheets
      for (const sheetName of TARGET_SHEETS) {
        try {
          const excelRows = await readAllRows(client, WORKBOOK_ID, sheetName, sessionId);
          for (const row of excelRows) {
            const dbRow = excelRowToDbRowForTable(row.values, sheetName);
            if (dbRow === null) { skippedCount++; }
            else { rowsBySheet[sheetName].push({ rowNumber: row.rowNumber, data: dbRow }); }
          }
        } catch (e) {
          errors.push(`Failed to read sheet ${sheetName}`);
        }
      }

      const totalRows = Object.values(rowsBySheet).reduce((sum, rows) => sum + rows.length, 0);
      if (totalRows === 0) {
        await closeExcelSession(client, WORKBOOK_ID, sessionId);
        return { totalRows: 0, insertedCount: 0, updatedCount: 0, deletedCount: 0, skippedCount, errorCount: errors.length, errors: errors.length > 0 ? errors : undefined };
      }

      // Process each table
      for (const sheetName of TARGET_SHEETS) {
        const rows = rowsBySheet[sheetName];
        const table = SHEET_TO_TABLE[sheetName];
        if (rows.length === 0) continue;

        const existingROs = await db.select({ id: table.id, ro: table.ro }).from(table);
        const roToIdMap = new Map<number, number>();
        for (const row of existingROs) {
          if (row.ro !== null) roToIdMap.set(row.ro, row.id);
        }

        const sheetRONumbers = new Set<number>();
        for (const { rowNumber, data } of rows) {
          if (data.ro !== null) sheetRONumbers.add(data.ro);
          try {
            const existingId = data.ro !== null ? roToIdMap.get(data.ro) : null;
            if (existingId !== null && existingId !== undefined) {
              await db.update(table).set(data as Record<string, unknown>).where(eq(table.id, existingId));
              updatedCount++;
            } else {
              await db.insert(table).values(data as Record<string, unknown>);
              insertedCount++;
            }
          } catch (error) {
            errors.push(`[${sheetName}] Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown"}`);
          }
        }

        // Delete orphans
        if (sheetRONumbers.size > 0) {
          const roArray = Array.from(sheetRONumbers);
          const orphanedRows = await db.select({ id: table.id, ro: table.ro }).from(table).where(and(isNotNull(table.ro), notInArray(table.ro, roArray)));
          for (const row of orphanedRows) {
            await db.delete(table).where(eq(table.id, row.id));
            deletedCount++;
          }
        }
      }

      // Clean orphaned notifications
      const orphanedNotifications = await db.select({ id: notificationQueue.id }).from(notificationQueue).leftJoin(active, eq(notificationQueue.repairOrderId, active.id)).where(isNull(active.id));
      if (orphanedNotifications.length > 0) {
        const orphanedIds = orphanedNotifications.map((n) => n.id);
        await db.delete(notificationQueue).where(inArray(notificationQueue.id, orphanedIds));
      }

      await closeExcelSession(client, WORKBOOK_ID, sessionId);
      sessionId = null;

      return { totalRows, insertedCount, updatedCount, deletedCount, skippedCount, errorCount: errors.length, errors: errors.length > 0 ? errors : undefined };
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
