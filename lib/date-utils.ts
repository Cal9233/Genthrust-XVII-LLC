/**
 * Shared date utilities for parsing and comparing dates
 * Ported from Genthrust_Repairs_v.2
 */

/**
 * Parse a date value to a Date object
 * Handles: MM/DD/YYYY, M/D/YYYY, MM/DD/YY, MM-DD-YYYY, YYYY-MM-DD, ISO 8601, and Excel serial numbers
 */
export function parseDate(
  value: string | number | Date | null | undefined
): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Handle Excel serial date numbers (days since 1899-12-30)
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Try MM/DD/YYYY or M/D/YYYY format
  const usDateSlashMatch4 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDateSlashMatch4) {
    const [, month, day, year] = usDateSlashMatch4;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try MM/DD/YY or M/D/YY format
  const usDateSlashMatch2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (usDateSlashMatch2) {
    const [, month, day, year2] = usDateSlashMatch2;
    let year = Number(year2);
    year = year < 50 ? 2000 + year : 1900 + year;
    const date = new Date(year, Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try MM-DD-YYYY or M-D-YYYY format
  const usDateDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (usDateDashMatch) {
    const [, month, day, year] = usDateDashMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format (ISO) or full ISO 8601
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(dateString: string | null | undefined): boolean {
  const date = parseDate(dateString);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
}

/**
 * Calculate days since a date
 */
export function daysSince(
  dateString: string | null | undefined
): number | null {
  const date = parseDate(dateString);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - date.getTime();
  return Math.floor(diffMs / 86400000);
}

/**
 * Calculate days until a date
 */
export function daysUntil(
  dateString: string | null | undefined
): number | null {
  const date = parseDate(dateString);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  return Math.floor(diffMs / 86400000);
}

/**
 * Format date as human-readable relative or absolute
 */
export function formatRelativeDate(
  dateString: string | null | undefined
): string {
  const date = parseDate(dateString);
  if (!date) return "unknown date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (date.getTime() - today.getTime()) / 86400000
  );

  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";

  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === today.getFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Format a Date object to US format string (mm/dd/yy)
 */
export function formatDateUS(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Format a Date object to ISO format string (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateISO(date: Date | null | undefined): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}
