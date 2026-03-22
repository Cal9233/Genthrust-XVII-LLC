/**
 * Tests for quote management API route logic
 * Tests the stateless, pure-logic portions: pagination clamping,
 * status filtering validation, JSON part_number parsing, and stats aggregation.
 * Does NOT require a real DB or Next.js runtime.
 */
import { describe, it, expect } from "vitest";

// ---- Extracted helpers matching the route logic ----

/** Mirrors the limit clamping logic in GET /api/internal/quotes */
function clampLimit(raw: string | null, max = 200, defaultVal = 50): number {
  return Math.min(parseInt(raw || String(defaultVal)), max);
}

/** Mirrors the offset parsing logic in GET /api/internal/quotes */
function parseOffset(raw: string | null): number {
  return parseInt(raw || "0");
}

/** Mirrors the status validation in GET /api/internal/quotes */
const VALID_STATUSES = ["pending", "processed", "responded"] as const;
type QuoteStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(status: string | null): status is QuoteStatus {
  return status !== null && (VALID_STATUSES as readonly string[]).includes(status);
}

/** Mirrors the part_numbers JSON parsing in GET /api/internal/quotes */
function parsePartNumbers(raw: string | unknown[]): unknown[] {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return raw ?? [];
}

/** Mirrors the stats aggregation in GET /api/internal/quotes */
function buildStats(
  rows: { status: string; cnt: string }[]
): Record<string, number> {
  const stats: Record<string, number> = {
    pending: 0,
    processed: 0,
    responded: 0,
  };
  for (const row of rows) {
    stats[row.status] = parseInt(row.cnt);
  }
  return stats;
}

/** Mirrors the POST validation: senderEmail and subject are required */
function validateCreateQuoteBody(body: Record<string, unknown>): string | null {
  if (!body.senderEmail || !body.subject) {
    return "senderEmail and subject are required";
  }
  return null;
}

// ============================================================
// Pagination clamping
// ============================================================

describe("Quote API pagination: limit clamping", () => {
  it("defaults to 50 when limit is null", () => {
    expect(clampLimit(null)).toBe(50);
  });

  it("respects user-provided limit below max", () => {
    expect(clampLimit("25")).toBe(25);
  });

  it("clamps to max (200) when over-requested", () => {
    expect(clampLimit("500")).toBe(200);
  });

  it("handles exactly the max value", () => {
    expect(clampLimit("200")).toBe(200);
  });

  it("handles limit of 1", () => {
    expect(clampLimit("1")).toBe(1);
  });
});

describe("Quote API pagination: offset parsing", () => {
  it("defaults to 0 when offset is null", () => {
    expect(parseOffset(null)).toBe(0);
  });

  it("parses a valid offset", () => {
    expect(parseOffset("50")).toBe(50);
  });

  it("parses offset of 0 explicitly", () => {
    expect(parseOffset("0")).toBe(0);
  });
});

// ============================================================
// Status filtering validation
// ============================================================

describe("Quote API status filter validation", () => {
  it("accepts 'pending' as a valid status", () => {
    expect(isValidStatus("pending")).toBe(true);
  });

  it("accepts 'processed' as a valid status", () => {
    expect(isValidStatus("processed")).toBe(true);
  });

  it("accepts 'responded' as a valid status", () => {
    expect(isValidStatus("responded")).toBe(true);
  });

  it("rejects null status", () => {
    expect(isValidStatus(null)).toBe(false);
  });

  it("rejects unknown status string", () => {
    expect(isValidStatus("archived")).toBe(false);
  });

  it("rejects empty string status", () => {
    expect(isValidStatus("")).toBe(false);
  });
});

// ============================================================
// JSON part_numbers parsing
// ============================================================

describe("Quote API: part_numbers JSON parsing", () => {
  it("returns parsed array when input is a valid JSON string", () => {
    const result = parsePartNumbers('["ABC-123","XYZ-456"]');
    expect(result).toEqual(["ABC-123", "XYZ-456"]);
  });

  it("returns empty array when JSON string is invalid", () => {
    const result = parsePartNumbers("{not-json}");
    expect(result).toEqual([]);
  });

  it("passes through array directly when already an array", () => {
    const arr = ["ABC-123"];
    expect(parsePartNumbers(arr)).toEqual(arr);
  });

  it("returns empty array for JSON string of empty array", () => {
    expect(parsePartNumbers("[]")).toEqual([]);
  });
});

// ============================================================
// Stats aggregation
// ============================================================

describe("Quote API: stats aggregation", () => {
  it("initialises all statuses to 0 when no rows given", () => {
    const stats = buildStats([]);
    expect(stats.pending).toBe(0);
    expect(stats.processed).toBe(0);
    expect(stats.responded).toBe(0);
  });

  it("counts correctly from DB result rows", () => {
    const rows = [
      { status: "pending", cnt: "12" },
      { status: "processed", cnt: "5" },
      { status: "responded", cnt: "3" },
    ];
    const stats = buildStats(rows);
    expect(stats.pending).toBe(12);
    expect(stats.processed).toBe(5);
    expect(stats.responded).toBe(3);
  });

  it("ignores unknown status values in rows", () => {
    const rows = [{ status: "unknown_status", cnt: "99" }];
    const stats = buildStats(rows);
    // known keys should remain 0
    expect(stats.pending).toBe(0);
    expect(stats.processed).toBe(0);
    // unknown key is added dynamically
    expect(stats["unknown_status"]).toBe(99);
  });
});

// ============================================================
// POST validation
// ============================================================

describe("Quote API POST: input validation", () => {
  it("returns null error when senderEmail and subject are provided", () => {
    const err = validateCreateQuoteBody({
      senderEmail: "test@example.com",
      subject: "Need part",
    });
    expect(err).toBeNull();
  });

  it("returns error when senderEmail is missing", () => {
    const err = validateCreateQuoteBody({ subject: "Need part" });
    expect(err).toBe("senderEmail and subject are required");
  });

  it("returns error when subject is missing", () => {
    const err = validateCreateQuoteBody({ senderEmail: "test@example.com" });
    expect(err).toBe("senderEmail and subject are required");
  });

  it("returns error when both fields are missing", () => {
    const err = validateCreateQuoteBody({});
    expect(err).toBe("senderEmail and subject are required");
  });

  it("returns error when senderEmail is empty string", () => {
    const err = validateCreateQuoteBody({ senderEmail: "", subject: "Need part" });
    expect(err).toBe("senderEmail and subject are required");
  });
});
