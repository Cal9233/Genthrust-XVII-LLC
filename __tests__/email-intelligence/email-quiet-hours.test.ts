/**
 * Tests for email-quiet-hours.ts
 * Validates timezone-aware quiet hour detection including cross-midnight ranges,
 * same-day ranges, missing/invalid config fallbacks.
 *
 * Strategy: mock date-fns-tz via vi.mock at the module level, then control the
 * returned hour in each test by updating the mock implementation.
 * Env vars are set/restored before/after each test group.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock date-fns-tz at module level — vitest ESM requires top-level vi.mock
// ---------------------------------------------------------------------------

vi.mock("date-fns-tz", () => ({
  toZonedTime: vi.fn(),
}));

import { toZonedTime } from "date-fns-tz";

const mockedToZonedTime = vi.mocked(toZonedTime);

// ---------------------------------------------------------------------------
// Import the module under test AFTER setting up the mock
// ---------------------------------------------------------------------------

import { isQuietHours, getQuietHoursEnd } from "@/lib/services/email-quiet-hours";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setHour(hour: number): void {
  const d = new Date(2026, 2, 17, hour, 0, 0, 0); // March 17, 2026
  mockedToZonedTime.mockReturnValue(d);
}

const ENV_KEYS = ["QUIET_HOURS_START", "QUIET_HOURS_END", "QUIET_HOURS_TIMEZONE"] as const;
let savedEnv: Record<string, string | undefined> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function setEnv(vars: Partial<Record<typeof ENV_KEYS[number], string | undefined>>): void {
  for (const key of ENV_KEYS) {
    if (key in vars) {
      if (vars[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = vars[key];
      }
    }
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

beforeEach(() => {
  saveEnv();
  vi.clearAllMocks();
});

afterEach(() => {
  restoreEnv();
});

// ---------------------------------------------------------------------------
// isQuietHours — no config (env vars not set)
// ---------------------------------------------------------------------------

describe("isQuietHours — no config", () => {
  it("returns false when neither QUIET_HOURS_START nor QUIET_HOURS_END is set", () => {
    setEnv({ QUIET_HOURS_START: undefined, QUIET_HOURS_END: undefined });
    expect(isQuietHours()).toBe(false);
  });

  it("returns false when QUIET_HOURS_START is missing but END is set", () => {
    setEnv({ QUIET_HOURS_START: undefined, QUIET_HOURS_END: "6" });
    expect(isQuietHours()).toBe(false);
  });

  it("returns false when QUIET_HOURS_END is missing but START is set", () => {
    setEnv({ QUIET_HOURS_START: "22", QUIET_HOURS_END: undefined });
    expect(isQuietHours()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isQuietHours — invalid config values
// ---------------------------------------------------------------------------

describe("isQuietHours — invalid config values", () => {
  it("returns false when start is not a valid integer", () => {
    setEnv({ QUIET_HOURS_START: "abc", QUIET_HOURS_END: "6" });
    expect(isQuietHours()).toBe(false);
  });

  it("returns false when start > 23", () => {
    setEnv({ QUIET_HOURS_START: "25", QUIET_HOURS_END: "6" });
    expect(isQuietHours()).toBe(false);
  });

  it("returns false when end < 0", () => {
    setEnv({ QUIET_HOURS_START: "22", QUIET_HOURS_END: "-1" });
    expect(isQuietHours()).toBe(false);
  });

  it("returns false when end > 23", () => {
    setEnv({ QUIET_HOURS_START: "22", QUIET_HOURS_END: "24" });
    expect(isQuietHours()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isQuietHours — cross-midnight range (22:00 – 06:00)
// Logic: hour >= 22 OR hour < 6
// ---------------------------------------------------------------------------

describe("isQuietHours — cross-midnight range (22:00 – 06:00)", () => {
  beforeEach(() => {
    setEnv({ QUIET_HOURS_START: "22", QUIET_HOURS_END: "6" });
  });

  it("returns true at hour=22 (start boundary)", () => {
    setHour(22);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=23 (well within quiet hours)", () => {
    setHour(23);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=0 (midnight — crosses midnight)", () => {
    setHour(0);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=3 (early morning)", () => {
    setHour(3);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=5 (just before end)", () => {
    setHour(5);
    expect(isQuietHours()).toBe(true);
  });

  it("returns false at hour=6 (end boundary — not in quiet hours)", () => {
    setHour(6);
    expect(isQuietHours()).toBe(false);
  });

  it("returns false at hour=12 (midday)", () => {
    setHour(12);
    expect(isQuietHours()).toBe(false);
  });

  it("returns false at hour=21 (just before start)", () => {
    setHour(21);
    expect(isQuietHours()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isQuietHours — same-day range (13:00 – 17:00)
// Logic: hour >= 13 AND hour < 17
// ---------------------------------------------------------------------------

describe("isQuietHours — same-day range (13:00 – 17:00)", () => {
  beforeEach(() => {
    setEnv({ QUIET_HOURS_START: "13", QUIET_HOURS_END: "17" });
  });

  it("returns true at hour=13 (start boundary)", () => {
    setHour(13);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=14 (inside range)", () => {
    setHour(14);
    expect(isQuietHours()).toBe(true);
  });

  it("returns true at hour=16 (just before end)", () => {
    setHour(16);
    expect(isQuietHours()).toBe(true);
  });

  it("returns false at hour=17 (end boundary — not quiet)", () => {
    setHour(17);
    expect(isQuietHours()).toBe(false);
  });

  it("returns false at hour=12 (before start)", () => {
    setHour(12);
    expect(isQuietHours()).toBe(false);
  });

  it("returns false at hour=18 (after end)", () => {
    setHour(18);
    expect(isQuietHours()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isQuietHours — timezone conversion error fallback
// ---------------------------------------------------------------------------

describe("isQuietHours — timezone error fallback", () => {
  it("returns false when toZonedTime throws", () => {
    setEnv({ QUIET_HOURS_START: "22", QUIET_HOURS_END: "6" });
    mockedToZonedTime.mockImplementation(() => {
      throw new Error("Invalid timezone");
    });
    // Should return false (conservative — don't suppress on error)
    expect(isQuietHours()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getQuietHoursEnd — basic behavior
// ---------------------------------------------------------------------------

describe("getQuietHoursEnd — disabled", () => {
  it("returns current time (approximately) when quiet hours not configured", () => {
    setEnv({ QUIET_HOURS_START: undefined, QUIET_HOURS_END: undefined });
    const before = Date.now();
    const result = getQuietHoursEnd();
    const after = Date.now();
    // Should return a date very close to now
    expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
    expect(result.getTime()).toBeLessThanOrEqual(after + 100);
  });
});
