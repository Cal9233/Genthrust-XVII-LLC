/**
 * Graph API Batch Operations for Excel
 * Ported from Genthrust_Repairs_v.2
 */

import { Client } from "@microsoft/microsoft-graph-client";
import type {
  BatchRequestItem,
  BatchResponse,
  BatchResponseItem,
} from "@/lib/types/graph";
import { getColumnLetter, EXCEL_COLUMNS } from "./excel-mapping";
import { getWorksheetPath } from "./index";

/**
 * Execute a batch request to the Graph API (max 20 items)
 */
export async function executeBatch(
  client: Client,
  requests: BatchRequestItem[],
  sessionId: string
): Promise<BatchResponse> {
  if (requests.length > 20) {
    throw new Error("Batch request exceeds 20 item limit");
  }

  if (requests.length === 0) {
    return { responses: [] };
  }

  const response = await client
    .api("/$batch")
    .header("workbook-session-id", sessionId)
    .post({ requests });

  return response as BatchResponse;
}

export function isRateLimitError(item: BatchResponseItem): boolean {
  return item.status === 429;
}

export function isSuccessful(item: BatchResponseItem): boolean {
  return item.status >= 200 && item.status < 300;
}

export function hasRateLimitError(response: BatchResponse): boolean {
  return response.responses.some(isRateLimitError);
}

export function getFailedResponses(
  response: BatchResponse
): BatchResponseItem[] {
  return response.responses.filter((item) => !isSuccessful(item));
}

/**
 * Build a PATCH request to update a single Excel row
 */
export function buildUpdateRowRequest(
  id: string,
  workbookId: string,
  worksheetName: string,
  rowNumber: number,
  values: (string | number | null)[]
): BatchRequestItem {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  return {
    id,
    method: "PATCH",
    url: `${worksheetPath}/range(address='A${rowNumber}:${lastCol}${rowNumber}')`,
    headers: { "Content-Type": "application/json" },
    body: { values: [values] },
  };
}

/**
 * Build multiple update row requests for a batch
 */
export function buildBatchUpdateRequests(
  workbookId: string,
  worksheetName: string,
  updates: Array<{ rowNumber: number; values: (string | number | null)[] }>
): BatchRequestItem[] {
  return updates.map((update, index) =>
    buildUpdateRowRequest(
      `update-${index}`,
      workbookId,
      worksheetName,
      update.rowNumber,
      update.values
    )
  );
}

/**
 * Build a POST request to delete a single Excel row
 */
export function buildDeleteRowRequest(
  id: string,
  workbookId: string,
  worksheetName: string,
  rowNumber: number
): BatchRequestItem {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  return {
    id,
    method: "POST",
    url: `${worksheetPath}/range(address='A${rowNumber}:${lastCol}${rowNumber}')/delete`,
    headers: { "Content-Type": "application/json" },
    body: { shift: "Up" },
  };
}

/**
 * Analyze batch response results
 */
export function analyzeBatchResponse(response: BatchResponse): {
  successful: number;
  failed: number;
  rateLimited: boolean;
  errors: string[];
} {
  let successful = 0;
  let failed = 0;
  let rateLimited = false;
  const errors: string[] = [];

  for (const item of response.responses) {
    if (isSuccessful(item)) {
      successful++;
    } else {
      failed++;
      if (isRateLimitError(item)) {
        rateLimited = true;
      }
      errors.push(
        `Request ${item.id} failed with status ${item.status}: ${JSON.stringify(item.body)}`
      );
    }
  }

  return { successful, failed, rateLimited, errors };
}
