/**
 * SharePoint Batch Operations
 * Replaces row-by-row Excel writes with batch operations via Graph API /$batch endpoint.
 * Ported from Genthrust_Repairs_v.2
 *
 * Key concepts:
 * - Graph API $batch endpoint accepts up to 20 requests per batch
 * - Uses workbook-session-id header for Excel operations
 * - Rate limit (429) errors should trigger retry via Trigger.dev
 */

export {
  executeBatch,
  buildUpdateRowRequest,
  buildBatchUpdateRequests,
  buildDeleteRowRequest,
  analyzeBatchResponse,
  hasRateLimitError,
  isRateLimitError,
  isSuccessful,
  getFailedResponses,
} from "@/lib/graph/batch";

export {
  createExcelSession,
  closeExcelSession,
  chunkArray,
  getWorkbookBasePath,
  getWorksheetPath,
} from "@/lib/graph/index";

export type {
  BatchRequestItem,
  BatchResponse,
  BatchResponseItem,
  ExcelSession,
} from "@/lib/types/graph";
