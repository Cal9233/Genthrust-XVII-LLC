/**
 * Tests for Email Intelligence Trigger.dev task exports.
 * Validates that scheduled tasks export correctly with proper IDs.
 * No DB, Graph API, or network access needed — all external deps mocked.
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE any imports that use them
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({ query: vi.fn().mockResolvedValue([]) }));

vi.mock("isomorphic-fetch", () => ({}));

vi.mock("@/lib/graph/inbox-reader", () => ({
  fetchNewEmails: vi.fn().mockResolvedValue({ emails: [], newDeltaLink: null }),
}));

vi.mock("@/lib/graph/todo-reader", () => ({
  getOpenTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/services/email-rules-engine", () => ({
  applyRules: vi.fn().mockReturnValue({ score: null, method: "llm", skipLlm: false }),
  loadRules: vi.fn().mockResolvedValue({}),
  clearRulesCache: vi.fn(),
}));

vi.mock("@/lib/services/email-context-enricher", () => ({
  enrichEmailContext: vi.fn().mockResolvedValue({
    roMatches: [],
    todoMatches: [],
    shopMatch: null,
  }),
}));

vi.mock("@/lib/services/email-haiku-scorer", () => ({
  scoreEmails: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/services/email-quiet-hours", () => ({
  isQuietHours: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/services/teams-notifier", () => ({
  sendUrgentCard: vi.fn().mockResolvedValue(undefined),
  sendBatchCard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/adaptive-cards", () => ({
  buildUrgentCard: vi.fn().mockReturnValue({ type: "AdaptiveCard", version: "1.4", body: [] }),
  buildBatchCard: vi.fn().mockReturnValue({ type: "AdaptiveCard", version: "1.4", body: [] }),
  buildDailyDigestCard: vi.fn().mockReturnValue({ type: "AdaptiveCard", version: "1.4", body: [] }),
}));

// ---------------------------------------------------------------------------
// Import trigger tasks (after mocks are in place)
// ---------------------------------------------------------------------------

import { inboxMonitor } from "@/trigger/inbox-monitor";
import { emailDigest } from "@/trigger/email-digest";
import { dailyDigest } from "@/trigger/daily-digest";

// ---------------------------------------------------------------------------
// inbox-monitor
// ---------------------------------------------------------------------------

describe("inboxMonitor scheduled task", () => {
  it("exports the inboxMonitor task", () => {
    expect(inboxMonitor).toBeDefined();
  });

  it("has task id 'inbox-monitor'", () => {
    expect(inboxMonitor.id).toBe("inbox-monitor");
  });
});

// ---------------------------------------------------------------------------
// email-digest
// ---------------------------------------------------------------------------

describe("emailDigest scheduled task", () => {
  it("exports the emailDigest task", () => {
    expect(emailDigest).toBeDefined();
  });

  it("has task id 'email-digest'", () => {
    expect(emailDigest.id).toBe("email-digest");
  });
});

// ---------------------------------------------------------------------------
// daily-digest
// ---------------------------------------------------------------------------

describe("dailyDigest scheduled task", () => {
  it("exports the dailyDigest task", () => {
    expect(dailyDigest).toBeDefined();
  });

  it("has task id 'daily-digest'", () => {
    expect(dailyDigest.id).toBe("daily-digest");
  });
});

// ---------------------------------------------------------------------------
// Verify all three tasks have distinct IDs (no collision)
// ---------------------------------------------------------------------------

describe("email intelligence task ID uniqueness", () => {
  it("all three scheduled tasks have distinct IDs", () => {
    const ids = [inboxMonitor.id, emailDigest.id, dailyDigest.id];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});
