/**
 * Excel Query Operations via Graph API
 * Ported from Genthrust_Repairs_v.2
 */

import { Client } from "@microsoft/microsoft-graph-client";
import type { ExcelRange } from "@/lib/types/graph";
import { getWorksheetPath } from "./index";

/**
 * Find multiple rows by RO numbers (batch lookup)
 */
export async function findRowsByRO(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string,
  roNumbers: number[]
): Promise<Map<number, number>> {
  const roSet = new Set(roNumbers);
  const result = new Map<number, number>();

  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  const range = (await client
    .api(`${worksheetPath}/range(address='A2:A10000')`)
    .header("workbook-session-id", sessionId)
    .get()) as ExcelRange;

  const values = range.values;

  for (let i = 0; i < values.length; i++) {
    const ro = values[i][0];
    if (ro !== null && ro !== "" && roSet.has(Number(ro))) {
      result.set(Number(ro), i + 2);
    }
  }

  return result;
}

/**
 * Get the next available row number for new entries
 */
export async function getNextAvailableRow(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<number> {
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  const usedRange = (await client
    .api(`${worksheetPath}/usedRange`)
    .header("workbook-session-id", sessionId)
    .select("rowCount")
    .get()) as { rowCount?: number };

  return (usedRange.rowCount ?? 1) + 1;
}

export interface ExcelRowData {
  rowNumber: number;
  values: (string | number | boolean | null)[];
}

/**
 * Read all data rows from an Excel worksheet
 */
export async function readAllRows(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<ExcelRowData[]> {
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);

  const usedRange = (await client
    .api(`${worksheetPath}/usedRange`)
    .header("workbook-session-id", sessionId)
    .select("rowCount")
    .get()) as { rowCount?: number };

  const lastRow = usedRange.rowCount ?? 1;

  if (lastRow <= 1) {
    return [];
  }

  const range = (await client
    .api(`${worksheetPath}/range(address='A2:U${lastRow}')`)
    .header("workbook-session-id", sessionId)
    .get()) as ExcelRange;

  const rows: ExcelRowData[] = [];

  for (let i = 0; i < range.values.length; i++) {
    const values = range.values[i];

    const hasData = values.some(
      (v) => v !== null && v !== undefined && v !== ""
    );

    if (hasData) {
      rows.push({
        rowNumber: i + 2,
        values: values as (string | number | boolean | null)[],
      });
    }
  }

  return rows;
}

/**
 * Check if a worksheet exists
 */
export async function worksheetExists(
  client: Client,
  workbookId: string,
  worksheetName: string,
  sessionId: string
): Promise<boolean> {
  try {
    const worksheetPath = getWorksheetPath(workbookId, worksheetName);
    await client
      .api(worksheetPath)
      .header("workbook-session-id", sessionId)
      .get();
    return true;
  } catch {
    return false;
  }
}
