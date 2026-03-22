/**
 * Centralized status constants and matching logic
 * Ported from Genthrust_Repairs_v.2
 */

export const ARCHIVED_STATUSES = [
  "COMPLETE",
  "NET",
  "PAID",
  "RETURNS",
  "BER",
  "RAI",
  "CANCELLED",
] as const;

export const STATUS_GROUPS = {
  WAITING_QUOTE: [
    "WAITING QUOTE",
    "WAITING FOR QUOTE",
    "AWAITING QUOTE",
    "PENDING",
  ],
  IN_WORK: ["IN WORK", "IN PROGRESS", "WORKING"],
  SHIPPED: ["SHIPPED", "IN TRANSIT", "CURRENTLY BEING SHIPPED", "SHIPPING"],
  APPROVED: ["APPROVED"],
} as const;

export const TRACKED_STATUSES = [
  "WAITING QUOTE",
  "APPROVED",
  "IN WORK",
  "IN PROGRESS",
  "SHIPPED",
  "IN TRANSIT",
  "RECEIVED",
] as const;

export function matchesStatusGroup(
  status: string | null | undefined,
  group: keyof typeof STATUS_GROUPS
): boolean {
  if (!status) return false;

  const normalizedStatus = status.toUpperCase().trim();
  const groupStatuses = STATUS_GROUPS[group];

  if (group === "APPROVED") {
    return groupStatuses.some((s) => normalizedStatus.startsWith(s));
  }

  return groupStatuses.some((s) => normalizedStatus === s);
}

export function isWaitingQuote(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "WAITING_QUOTE");
}

export function isInWork(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "IN_WORK");
}

export function isShipped(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "SHIPPED");
}

export function isApproved(status: string | null | undefined): boolean {
  return matchesStatusGroup(status, "APPROVED");
}

export function isTrackedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalizedStatus = status.toUpperCase().trim();
  return TRACKED_STATUSES.some((s) => normalizedStatus === s);
}
