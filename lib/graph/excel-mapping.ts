/**
 * Excel column mapping and conversion utilities
 * Ported from Genthrust_Repairs_v.2 - fixed currentStatus typo
 */

import type { RepairOrderExcelRow } from "@/lib/types/graph";
import type { active, net, paid, returns } from "@/lib/db/schema";
import { parseDate, formatDateUS, formatDateISO } from "@/lib/date-utils";

type Active = typeof active.$inferSelect;
type Net = typeof net.$inferSelect;
type Paid = typeof paid.$inferSelect;
type Returns = typeof returns.$inferSelect;

export type SheetTableName = "Active" | "Net" | "Paid" | "Returns";

/**
 * Excel column mapping for repair orders (columns A-U)
 * NOTE: DB columns use currentStatus (fixed typo), but Excel uses the original mapping
 */
export const EXCEL_COLUMNS = [
  "ro",
  "dateMade",
  "shopName",
  "part",
  "serial",
  "partDescription",
  "reqWork",
  "dateDroppedOff",
  "estimatedCost",
  "finalCost",
  "terms",
  "shopRef",
  "estimatedDeliveryDate",
  "currentStatus",
  "currentStatusDate",
  "genthrustStatus",
  "shopStatus",
  "trackingNumberPickingUp",
  "notes",
  "lastDateUpdated",
  "nextDateToUpdate",
] as const;

export type ExcelColumnKey = (typeof EXCEL_COLUMNS)[number];

/**
 * Convert a database row to an Excel row array
 */
export function dbRowToExcelRow(row: Active): (string | number | null)[] {
  const dateFields = new Set([
    "dateMade",
    "dateDroppedOff",
    "estimatedDeliveryDate",
    "currentStatusDate",
    "lastDateUpdated",
    "nextDateToUpdate",
  ]);

  return EXCEL_COLUMNS.map((col) => {
    const value = row[col as keyof Active];

    if (value === undefined || value === null) {
      return null;
    }

    if (dateFields.has(col)) {
      const date = parseDate(value as string | number | Date | null);
      return formatDateUS(date);
    }

    return value as string | number | null;
  });
}

export function excelRowToArray(
  row: RepairOrderExcelRow
): (string | number | null)[] {
  return EXCEL_COLUMNS.map((col) => row[col] ?? null);
}

export type DbInsertRow = Omit<Active, "id" | "createdAt">;
export type DbInsertRowActive = Omit<Active, "id" | "createdAt">;
export type DbInsertRowNet = Omit<Net, "id" | "createdAt">;
export type DbInsertRowPaid = Omit<Paid, "id" | "createdAt">;
export type DbInsertRowReturns = Omit<Returns, "id" | "createdAt">;
export type AnyDbInsertRow =
  | DbInsertRowActive
  | DbInsertRowNet
  | DbInsertRowPaid
  | DbInsertRowReturns;

function parseCurrency(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    if (cleaned === "") return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function cleanStatus(value: unknown): string | null {
  const str = parseString(value);
  if (str === null) return null;

  let cleaned = str
    .replace(/[><=\-*#@!~^&|]+$/g, "")
    .replace(/^[><=\-*#@!~^&|]+/g, "")
    .trim();

  if (cleaned === "") return null;

  cleaned = cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return cleaned;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.trim());
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseDateToUS(value: unknown): string | null {
  const date = parseDate(value as string | number | Date | null | undefined);
  return formatDateUS(date);
}

/**
 * Convert an Excel row array to a database insert row
 */
export function excelRowToDbRow(
  values: (string | number | boolean | null | undefined)[]
): DbInsertRow | null {
  const ro = parseNumber(values[0]);
  if (ro === null) return null;

  const dbRow: DbInsertRow = {
    ro,
    dateMade: parseDateToUS(values[1]),
    shopName: parseString(values[2]),
    part: parseString(values[3]),
    serial: parseString(values[4]),
    partDescription: parseString(values[5]),
    reqWork: parseString(values[6]),
    dateDroppedOff: parseDateToUS(values[7]),
    estimatedCost: parseCurrency(values[8]),
    finalCost: parseCurrency(values[9]),
    terms: parseString(values[10]),
    shopRef: parseString(values[11]),
    estimatedDeliveryDate: parseDateToUS(values[12]),
    currentStatus: cleanStatus(values[13]),
    currentStatusDate: parseDateToUS(values[14]),
    genthrustStatus: cleanStatus(values[15]),
    shopStatus: cleanStatus(values[16]),
    trackingNumberPickingUp: parseString(values[17]),
    notes: parseString(values[18]),
    lastDateUpdated: parseDateToUS(values[19]),
    nextDateToUpdate: parseDateToUS(values[20]),
    erpPoId: null,
    erpLastSyncAt: null,
    erpSyncStatus: "LOCAL_ONLY",
  };

  return dbRow;
}

/**
 * Convert an Excel row array to a table-specific database insert row
 */
export function excelRowToDbRowForTable(
  values: (string | number | boolean | null | undefined)[],
  tableName: SheetTableName
): AnyDbInsertRow | null {
  const ro = parseNumber(values[0]);
  if (ro === null) return null;

  const rawFinalCost = values[9];
  let finalCost: number | string | null;
  if (tableName === "Paid" || tableName === "Returns") {
    finalCost =
      rawFinalCost !== null && rawFinalCost !== undefined && rawFinalCost !== ""
        ? String(rawFinalCost)
        : null;
  } else {
    finalCost = parseCurrency(rawFinalCost);
  }

  const rawDateMade = values[1];
  let dateMade: string | null;
  if (tableName === "Net" || tableName === "Paid") {
    const date = parseDate(
      typeof rawDateMade === "boolean" ? null : rawDateMade
    );
    dateMade = formatDateISO(date);
  } else {
    dateMade = parseDateToUS(rawDateMade);
  }

  const dbRow = {
    ro,
    dateMade,
    shopName: parseString(values[2]),
    part: parseString(values[3]),
    serial: parseString(values[4]),
    partDescription: parseString(values[5]),
    reqWork: parseString(values[6]),
    dateDroppedOff: parseDateToUS(values[7]),
    estimatedCost: parseCurrency(values[8]),
    finalCost,
    terms: parseString(values[10]),
    shopRef: parseString(values[11]),
    estimatedDeliveryDate: parseDateToUS(values[12]),
    currentStatus: cleanStatus(values[13]),
    currentStatusDate: parseDateToUS(values[14]),
    genthrustStatus: cleanStatus(values[15]),
    shopStatus: cleanStatus(values[16]),
    trackingNumberPickingUp: parseString(values[17]),
    notes: parseString(values[18]),
    lastDateUpdated: parseDateToUS(values[19]),
    nextDateToUpdate: parseDateToUS(values[20]),
  };

  return dbRow as AnyDbInsertRow;
}

export function getColumnLetter(index: number): string {
  let letter = "";
  let idx = index;
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}

export function getRowRangeAddress(
  worksheetName: string,
  rowNumber: number
): string {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  return `${worksheetName}!A${rowNumber}:${lastCol}${rowNumber}`;
}

export function getRowsRangeAddress(
  worksheetName: string,
  startRow: number,
  endRow: number
): string {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  return `${worksheetName}!A${startRow}:${lastCol}${endRow}`;
}

export function getColumnHeaders(): string[] {
  return EXCEL_COLUMNS.map((col) =>
    col.replace(/([A-Z])/g, "_$1").toUpperCase()
  );
}
