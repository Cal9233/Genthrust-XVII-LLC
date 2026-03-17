/**
 * Tests for email-rules-engine.ts
 * Validates rule priority ordering, built-in keyword detection,
 * VIP floor logic, blocklist rejection, and cache behavior.
 * No DB or network access required — uses loadRules to inject mock rules.
 *
 * Key behaviors under test:
 * - suppressKeywords match on searchText = subject + bodyPreview (NOT from address)
 * - Rule priority: blocklist > VIP > urgent keyword > db boost > business keyword > db suppress > suppress keyword > LLM
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyRules,
  loadRules,
  clearRulesCache,
} from "@/lib/services/email-rules-engine";
import * as dbModule from "@/lib/db";

// ---------------------------------------------------------------------------
// Mock DB query so loadRules doesn't need a real database
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(dbModule.query);

function makeEmail(
  from: string,
  subject: string,
  bodyPreview: string
): { from: string; subject: string; bodyPreview: string } {
  return { from, subject, bodyPreview };
}

async function loadEmptyRules(): Promise<void> {
  mockQuery.mockResolvedValueOnce([]);
  await loadRules();
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearRulesCache();
  vi.clearAllMocks();
});

afterEach(() => {
  clearRulesCache();
});

// ---------------------------------------------------------------------------
// applyRules when rules NOT loaded
// ---------------------------------------------------------------------------

describe("applyRules — no rules loaded", () => {
  it("returns LLM path when cache is empty", () => {
    const result = applyRules(makeEmail("any@vendor.com", "hello", "body"));
    expect(result.score).toBeNull();
    expect(result.method).toBe("llm");
    expect(result.skipLlm).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Built-in urgent keywords (checked in subject + bodyPreview)
// ---------------------------------------------------------------------------

describe("applyRules — built-in urgent keywords", () => {
  beforeEach(loadEmptyRules);

  it("scores 'AOG' in subject as 9, skipLlm=true", () => {
    const result = applyRules(makeEmail("unknown@vendor.com", "AOG - Part needed ASAP", ""));
    expect(result.score).toBe(9);
    expect(result.skipLlm).toBe(true);
    expect(result.method).toBe("rules");
  });

  it("scores 'aircraft on ground' in body as 9, skipLlm=true", () => {
    const result = applyRules(
      makeEmail("ops@airline.com", "Urgent", "We have an aircraft on ground situation")
    );
    expect(result.score).toBe(9);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'faa ad' in subject as 9, skipLlm=true", () => {
    const result = applyRules(makeEmail("faa@gov.com", "New FAA AD issued", ""));
    expect(result.score).toBe(9);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'easa' in subject as 9, skipLlm=true", () => {
    const result = applyRules(makeEmail("easa@easa.eu", "EASA Safety Directive", ""));
    expect(result.score).toBe(9);
    expect(result.skipLlm).toBe(true);
  });

  it("matching is case-insensitive for urgent keywords", () => {
    const result = applyRules(makeEmail("ops@airline.com", "aog situation", ""));
    expect(result.score).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Built-in business keywords
// ---------------------------------------------------------------------------

describe("applyRules — built-in business keywords", () => {
  beforeEach(loadEmptyRules);

  it("scores 'rfq' as 8, skipLlm=true", () => {
    const result = applyRules(makeEmail("buyer@airline.com", "RFQ for Part 123", ""));
    expect(result.score).toBe(8);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'purchase order' as 8, skipLlm=true", () => {
    const result = applyRules(makeEmail("vendor@shop.com", "Purchase Order Received", ""));
    expect(result.score).toBe(8);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'repair complete' as 8, skipLlm=true", () => {
    const result = applyRules(makeEmail("shop@mro.com", "Your Repair Complete", ""));
    expect(result.score).toBe(8);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'ready for pickup' as 8, skipLlm=true", () => {
    const result = applyRules(makeEmail("shop@mro.com", "ready for pickup", ""));
    expect(result.score).toBe(8);
    expect(result.skipLlm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Built-in suppress keywords (match on subject+bodyPreview, NOT from address)
// ---------------------------------------------------------------------------

describe("applyRules — built-in suppress keywords", () => {
  beforeEach(loadEmptyRules);

  it("scores 'unsubscribe' in bodyPreview as 2, skipLlm=true", () => {
    // Use a non-suppress from address to isolate keyword matching
    const result = applyRules(makeEmail("info@vendor.com", "Weekly Digest", "Click to unsubscribe"));
    expect(result.score).toBe(2);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'newsletter' in subject as 2, skipLlm=true", () => {
    const result = applyRules(makeEmail("info@vendor.com", "Our Monthly Newsletter", ""));
    expect(result.score).toBe(2);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'automated message' in bodyPreview as 2, skipLlm=true", () => {
    const result = applyRules(makeEmail("info@vendor.com", "Notification", "This is an automated message"));
    expect(result.score).toBe(2);
    expect(result.skipLlm).toBe(true);
  });

  it("scores 'noreply' in subject as 2, skipLlm=true", () => {
    // noreply is a suppress keyword checked in subject+bodyPreview, NOT from
    const result = applyRules(makeEmail("info@vendor.com", "noreply: do not respond", ""));
    expect(result.score).toBe(2);
    expect(result.skipLlm).toBe(true);
  });

  it("does NOT suppress based on from address containing noreply", () => {
    // from address is not part of searchText — so noreply@vendor.com alone
    // does not trigger suppression if subject/body have no suppress keywords
    const result = applyRules(makeEmail("noreply@vendor.com", "Order Confirmation", "Your order is ready"));
    // Should fall through to LLM (no keyword match in subject+body)
    expect(result.score).toBeNull();
    expect(result.method).toBe("llm");
  });
});

// ---------------------------------------------------------------------------
// Blocklist — highest priority
// ---------------------------------------------------------------------------

describe("applyRules — blocklist (highest priority)", () => {
  beforeEach(async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 1, rule_type: "blocklist", pattern: "spam@badvendor.com", score_effect: null },
      { id: 2, rule_type: "blocklist", pattern: "spammydomain.com", score_effect: null },
    ]);
    await loadRules();
  });

  it("score=0, skipLlm=true for exact blocklist address match", () => {
    const result = applyRules(makeEmail("spam@badvendor.com", "Hello", ""));
    expect(result.score).toBe(0);
    expect(result.skipLlm).toBe(true);
    expect(result.method).toBe("rules");
  });

  it("score=0, skipLlm=true for blocklist domain match", () => {
    const result = applyRules(makeEmail("info@spammydomain.com", "RFQ", ""));
    expect(result.score).toBe(0);
    expect(result.skipLlm).toBe(true);
  });

  it("blocklist overrides urgent AOG keyword in subject", () => {
    // Blocklist is step 1, keywords are step 3 — blocklist wins
    const result = applyRules(makeEmail("spam@badvendor.com", "AOG EMERGENCY", "aircraft on ground"));
    expect(result.score).toBe(0);
    expect(result.skipLlm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VIP — score floor, does NOT skip LLM
// ---------------------------------------------------------------------------

describe("applyRules — VIP list", () => {
  beforeEach(async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 1, rule_type: "vip", pattern: "bigclient@airline.com", score_effect: 7 },
      { id: 2, rule_type: "vip", pattern: "premiershop.com", score_effect: 8 },
    ]);
    await loadRules();
  });

  it("VIP match: sets score floor from score_effect, skipLlm=false", () => {
    const result = applyRules(makeEmail("bigclient@airline.com", "General inquiry", ""));
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.skipLlm).toBe(false);
    expect(result.method).toBe("rules");
  });

  it("VIP floor never goes below 7", () => {
    const result = applyRules(makeEmail("bigclient@airline.com", "hello", ""));
    expect(result.score).toBeGreaterThanOrEqual(7);
  });

  it("VIP domain match works", () => {
    const result = applyRules(makeEmail("purchasing@premiershop.com", "order", ""));
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.skipLlm).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DB keyword boosts
// ---------------------------------------------------------------------------

describe("applyRules — DB keyword boosts", () => {
  beforeEach(async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 1, rule_type: "keyword_boost", pattern: "bell206", score_effect: 9 },
    ]);
    await loadRules();
  });

  it("DB boost pattern in subject returns score_effect, skipLlm=true", () => {
    const result = applyRules(makeEmail("vendor@shop.com", "Bell206 part available", ""));
    expect(result.score).toBe(9);
    expect(result.skipLlm).toBe(true);
    expect(result.method).toBe("rules");
  });
});

// ---------------------------------------------------------------------------
// DB keyword suppress
// ---------------------------------------------------------------------------

describe("applyRules — DB keyword suppression", () => {
  beforeEach(async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 1, rule_type: "keyword_suppress", pattern: "linkedin notification", score_effect: 1 },
    ]);
    await loadRules();
  });

  it("DB suppress pattern in subject returns score_effect, skipLlm=true", () => {
    const result = applyRules(makeEmail("info@notify.com", "linkedin notification", ""));
    expect(result.score).toBe(1);
    expect(result.skipLlm).toBe(true);
    expect(result.method).toBe("rules");
  });
});

// ---------------------------------------------------------------------------
// No rule match — sends to LLM
// ---------------------------------------------------------------------------

describe("applyRules — no match → LLM", () => {
  beforeEach(loadEmptyRules);

  it("returns null score and skipLlm=false for unrecognized email", () => {
    const result = applyRules(makeEmail("info@randomvendor.com", "Hello", "Just checking in"));
    expect(result.score).toBeNull();
    expect(result.skipLlm).toBe(false);
    expect(result.method).toBe("llm");
  });
});

// ---------------------------------------------------------------------------
// Rule priority: blocklist > VIP > urgent keywords > LLM
// Test that blocklist beats VIP AND blocklist beats urgent keyword
// ---------------------------------------------------------------------------

describe("applyRules — rule priority ordering", () => {
  it("blocklist takes priority over urgent keyword match", async () => {
    // Fresh rules: only blocklist
    mockQuery.mockResolvedValueOnce([
      { id: 1, rule_type: "blocklist", pattern: "blocked@domain.com", score_effect: null },
    ]);
    await loadRules();

    // "AOG" in subject would score 9 via keywords, but blocklist runs first
    const result = applyRules(makeEmail("blocked@domain.com", "AOG Emergency", "aircraft on ground"));
    expect(result.score).toBe(0);
    expect(result.skipLlm).toBe(true);
  });

  it("VIP check runs before keyword matching", async () => {
    // Fresh rules: only VIP
    mockQuery.mockResolvedValueOnce([
      { id: 2, rule_type: "vip", pattern: "vip@important.com", score_effect: 9 },
    ]);
    await loadRules();

    // VIP match should return before keywords are checked
    const result = applyRules(makeEmail("vip@important.com", "General inquiry", ""));
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.skipLlm).toBe(false); // VIP always has skipLlm=false
  });
});
