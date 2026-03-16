/**
 * Tests for lib/date-utils.ts
 * Pure functions — fully testable without DB or network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseDate,
  isOverdue,
  daysSince,
  daysUntil,
  formatRelativeDate,
  formatDateUS,
  formatDateISO,
} from "@/lib/date-utils";

// ============================================================
// parseDate
// ============================================================

describe("parseDate", () => {
  it("returns null for null input", () => {
    expect(parseDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns the same Date object when input is already a Date", () => {
    const d = new Date(2024, 0, 15);
    expect(parseDate(d)).toEqual(d);
  });

  it("returns null for an invalid Date object", () => {
    expect(parseDate(new Date("invalid"))).toBeNull();
  });

  it("parses MM/DD/YYYY format", () => {
    const result = parseDate("01/15/2024");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(15);
  });

  it("parses M/D/YYYY format (single digit month/day)", () => {
    const result = parseDate("3/5/2023");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2023);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });

  it("parses MM/DD/YY format with year < 50 as 2000s", () => {
    const result = parseDate("01/15/24");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2024);
  });

  it("parses MM/DD/YY format with year >= 50 as 1900s", () => {
    const result = parseDate("01/15/65");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(1965);
  });

  it("parses MM-DD-YYYY format", () => {
    const result = parseDate("06-20-2023");
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2023);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(20);
  });

  it("parses YYYY-MM-DD ISO format", () => {
    // new Date("YYYY-MM-DD") is UTC midnight; use getUTC* to avoid tz shift
    const result = parseDate("2024-03-14");
    expect(result).not.toBeNull();
    expect(result!.getUTCFullYear()).toBe(2024);
    expect(result!.getUTCMonth()).toBe(2);
    expect(result!.getUTCDate()).toBe(14);
  });

  it("parses Excel serial number (days since 1899-12-30)", () => {
    // Excel serial 44927 = 2023-01-01
    const result = parseDate(44927);
    expect(result).not.toBeNull();
    // Just verify it's a valid date in the right era
    expect(result!.getFullYear()).toBeGreaterThanOrEqual(2020);
  });

  it("returns null for a completely non-date string", () => {
    expect(parseDate("not a date at all")).toBeNull();
  });
});

// ============================================================
// isOverdue
// ============================================================

describe("isOverdue", () => {
  it("returns false for null/undefined", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });

  it("returns true for a date in the past", () => {
    expect(isOverdue("01/01/2020")).toBe(true);
  });

  it("returns false for a date far in the future", () => {
    expect(isOverdue("12/31/2099")).toBe(false);
  });

  it("returns false for an unparseable string", () => {
    expect(isOverdue("not-a-date")).toBe(false);
  });
});

// ============================================================
// daysSince
// ============================================================

describe("daysSince", () => {
  it("returns null for null input", () => {
    expect(daysSince(null)).toBeNull();
  });

  it("returns a positive number for a past date", () => {
    const result = daysSince("01/01/2020");
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("returns a negative number for a future date", () => {
    const result = daysSince("12/31/2099");
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0);
  });
});

// ============================================================
// daysUntil
// ============================================================

describe("daysUntil", () => {
  it("returns null for null input", () => {
    expect(daysUntil(null)).toBeNull();
  });

  it("returns a positive number for a future date", () => {
    const result = daysUntil("12/31/2099");
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("returns a negative number for a past date", () => {
    const result = daysUntil("01/01/2020");
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0);
  });
});

// ============================================================
// formatRelativeDate
// ============================================================

describe("formatRelativeDate", () => {
  it("returns 'unknown date' for null", () => {
    expect(formatRelativeDate(null)).toBe("unknown date");
  });

  it("returns 'unknown date' for undefined", () => {
    expect(formatRelativeDate(undefined)).toBe("unknown date");
  });

  it("returns a non-empty string for a valid past date", () => {
    const result = formatRelativeDate("01/01/2020");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Past date should not say 'today', 'tomorrow', or 'yesterday' for Jan 1 2020
    expect(result).not.toBe("today");
  });
});

// ============================================================
// formatDateUS
// ============================================================

describe("formatDateUS", () => {
  it("returns null for null input", () => {
    expect(formatDateUS(null)).toBeNull();
  });

  it("formats a date as MM/DD/YY", () => {
    const d = new Date(2024, 0, 5); // Jan 5 2024
    const result = formatDateUS(d);
    expect(result).toBe("01/05/24");
  });

  it("returns null for invalid date", () => {
    expect(formatDateUS(new Date("invalid"))).toBeNull();
  });
});

// ============================================================
// formatDateISO
// ============================================================

describe("formatDateISO", () => {
  it("returns null for null input", () => {
    expect(formatDateISO(null)).toBeNull();
  });

  it("formats as YYYY-MM-DD HH:mm:ss", () => {
    const d = new Date("2024-06-15T10:30:45Z");
    const result = formatDateISO(d);
    expect(result).not.toBeNull();
    // Should have the YYYY-MM-DD portion
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
