/**
 * Tests for adaptive-cards.ts
 * Validates card structure, content, edge cases, and type contracts.
 * No network or DB access needed — pure unit tests on JSON builders.
 */
import { describe, it, expect } from "vitest";
import {
  buildUrgentCard,
  buildBatchCard,
  buildDailyDigestCard,
  type ScoredEmailForCard,
  type ROContext,
  type TodoContext,
  type ShopContext,
  type DailyDigestStats,
  type GapWarning,
} from "@/lib/services/adaptive-cards";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseEmail: ScoredEmailForCard = {
  from: "vendor@heliparts.com",
  subject: "RO #4521 Quote Ready",
  bodyPreview: "Your part is ready for pickup at our facility.",
  score: 8,
  reason: "Matches active repair order",
  webLink: "https://outlook.office.com/mail/...",
  receivedDateTime: "2026-03-17T14:30:00Z",
};

const roContext: ROContext = {
  roNumber: "4521",
  shopName: "Heliparts Inc",
  partDescription: "Main Rotor Hub",
  status: "READY FOR PICKUP",
  estimatedCost: 5000,
  finalCost: null,
};

const todoContext: TodoContext = {
  taskTitle: "[GenThrust] Follow up with Heliparts on RO 4521",
  dueDate: "2026-03-20",
};

const shopContext: ShopContext = {
  businessName: "Heliparts Inc",
  contact: "John Smith",
  paymentTerms: "Net 30",
};

const stats: DailyDigestStats = {
  urgent: 3,
  important: 7,
  low: 12,
  skipped: 5,
  totalProcessed: 27,
  roMatches: 4,
  todoMatches: 2,
};

// ---------------------------------------------------------------------------
// buildUrgentCard
// ---------------------------------------------------------------------------

describe("buildUrgentCard — basic structure", () => {
  it("returns an AdaptiveCard with correct type and version", () => {
    const card = buildUrgentCard(baseEmail, 8, "Matches RO");
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.4");
    expect(card.$schema).toBe("http://adaptivecards.io/schemas/adaptive-card.json");
  });

  it("has a non-empty body array", () => {
    const card = buildUrgentCard(baseEmail, 8, "Matches RO");
    expect(Array.isArray(card.body)).toBe(true);
    expect(card.body.length).toBeGreaterThan(0);
  });

  it("includes an Open in Outlook action with correct webLink", () => {
    const card = buildUrgentCard(baseEmail, 8, "Matches RO");
    const actions = card.actions as Array<Record<string, unknown>>;
    expect(actions).toBeDefined();
    const openAction = actions?.find((a) => a.type === "Action.OpenUrl");
    expect(openAction).toBeDefined();
    expect(openAction?.url).toBe(baseEmail.webLink);
    expect(openAction?.title).toBe("Open in Outlook");
  });

  it("includes sender and subject in body", () => {
    const card = buildUrgentCard(baseEmail, 8, "test reason");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("vendor@heliparts.com");
    expect(bodyStr).toContain("RO #4521 Quote Ready");
  });

  it("includes score in body", () => {
    const card = buildUrgentCard(baseEmail, 9, "AOG");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("9");
  });

  it("includes reason text in body", () => {
    const card = buildUrgentCard(baseEmail, 8, "Custom reason text");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Custom reason text");
  });
});

describe("buildUrgentCard — optional RO context", () => {
  it("includes RO section when roContext is provided", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", roContext);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("4521");
    expect(bodyStr).toContain("Heliparts Inc");
    expect(bodyStr).toContain("Main Rotor Hub");
    expect(bodyStr).toContain("READY FOR PICKUP");
  });

  it("omits RO section when roContext is null", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", null);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).not.toContain("Repair Order Match");
  });

  it("shows estimatedCost when finalCost is null", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", roContext);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Est. Cost");
    expect(bodyStr).toContain("5,000");
  });

  it("shows finalCost and not estimatedCost when finalCost is set", () => {
    const roWithFinal: ROContext = { ...roContext, finalCost: 4800, estimatedCost: 5000 };
    const card = buildUrgentCard(baseEmail, 8, "reason", roWithFinal);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Final Cost");
    expect(bodyStr).toContain("4,800");
    expect(bodyStr).not.toContain("Est. Cost");
  });
});

describe("buildUrgentCard — optional To-Do context", () => {
  it("includes To-Do section when todoContext is provided", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", null, todoContext);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("[GenThrust] Follow up with Heliparts");
    expect(bodyStr).toContain("Related To-Do Task");
  });

  it("includes due date when provided", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", null, todoContext);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("2026-03-20");
  });

  it("omits due date when todoContext.dueDate is null", () => {
    const noDue: TodoContext = { taskTitle: "Some task", dueDate: null };
    const card = buildUrgentCard(baseEmail, 8, "reason", null, noDue);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).not.toContain("Due:");
  });
});

describe("buildUrgentCard — optional shop context", () => {
  it("includes shop info when shopContext is provided", () => {
    const card = buildUrgentCard(baseEmail, 8, "reason", null, null, shopContext);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Heliparts Inc");
    expect(bodyStr).toContain("John Smith");
    expect(bodyStr).toContain("Net 30");
  });

  it("omits contact and terms when they are null", () => {
    const minimalShop: ShopContext = {
      businessName: "Generic Shop",
      contact: null,
      paymentTerms: null,
    };
    const card = buildUrgentCard(baseEmail, 8, "reason", null, null, minimalShop);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Generic Shop");
    // Should not include null contact/terms fields
    expect(bodyStr).not.toContain('"Contact:"');
    expect(bodyStr).not.toContain('"Terms:"');
  });
});

describe("buildUrgentCard — score-based color", () => {
  it("uses 'attention' color for score >= 9", () => {
    const card = buildUrgentCard(baseEmail, 9, "critical");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("attention");
  });

  it("uses 'warning' color for score 7-8", () => {
    const card = buildUrgentCard(baseEmail, 7, "high");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("warning");
  });

  it("uses 'accent' color for score 5-6", () => {
    const medEmail: ScoredEmailForCard = { ...baseEmail, score: 6 };
    const card = buildUrgentCard(medEmail, 6, "medium");
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("accent");
  });
});

// ---------------------------------------------------------------------------
// buildBatchCard
// ---------------------------------------------------------------------------

describe("buildBatchCard — basic structure", () => {
  it("returns AdaptiveCard type and version 1.4", () => {
    const card = buildBatchCard([baseEmail]);
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.4");
  });

  it("includes email count in header", () => {
    const emails = [baseEmail, { ...baseEmail, subject: "Second email" }];
    const card = buildBatchCard(emails);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("2 emails");
  });

  it("includes Toggle action for collapsible details", () => {
    const card = buildBatchCard([baseEmail]);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Action.ToggleVisibility");
  });

  it("creates a detail container for each email with isVisible false", () => {
    const emails = [baseEmail, { ...baseEmail, subject: "Second" }];
    const card = buildBatchCard(emails);
    const bodyStr = JSON.stringify(card.body);
    // Two detail containers should be hidden by default
    const hiddenCount = (bodyStr.match(/"isVisible":false/g) || []).length;
    expect(hiddenCount).toBe(2);
  });

  it("handles empty email array gracefully", () => {
    const card = buildBatchCard([]);
    expect(card.type).toBe("AdaptiveCard");
    expect(Array.isArray(card.body)).toBe(true);
    // Header should still be present
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("0 emails");
  });

  it("includes Open action links for each email", () => {
    const card = buildBatchCard([baseEmail]);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Action.OpenUrl");
    expect(bodyStr).toContain("Open");
  });

  it("truncates bodyPreview to max 200 chars", () => {
    const longBody = "x".repeat(300);
    const email: ScoredEmailForCard = { ...baseEmail, bodyPreview: longBody };
    const card = buildBatchCard([email]);
    const bodyStr = JSON.stringify(card.body);
    // Preview should be truncated with "..."
    expect(bodyStr).toContain("...");
    // Verify the full 300 chars are not present
    expect(bodyStr).not.toContain("x".repeat(300));
  });
});

// ---------------------------------------------------------------------------
// buildDailyDigestCard
// ---------------------------------------------------------------------------

describe("buildDailyDigestCard — basic structure", () => {
  it("returns AdaptiveCard type and version 1.4", () => {
    const card = buildDailyDigestCard(stats);
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.4");
  });

  it("includes total processed count", () => {
    const card = buildDailyDigestCard(stats);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("27");
  });

  it("includes all tier counts", () => {
    const card = buildDailyDigestCard(stats);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("3"); // urgent
    expect(bodyStr).toContain("7"); // important
    expect(bodyStr).toContain("12"); // low
    expect(bodyStr).toContain("5"); // skipped
  });

  it("includes RO and To-Do match counts when > 0", () => {
    const card = buildDailyDigestCard(stats);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Context Matches");
    expect(bodyStr).toContain("4"); // roMatches
    expect(bodyStr).toContain("2"); // todoMatches
  });

  it("omits context match section when both counts are 0", () => {
    const noMatches: DailyDigestStats = { ...stats, roMatches: 0, todoMatches: 0 };
    const card = buildDailyDigestCard(noMatches);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).not.toContain("Context Matches");
  });
});

describe("buildDailyDigestCard — gap warnings", () => {
  const gaps: GapWarning[] = [
    { mailbox: "ops@genthrust.net", lastSuccessAt: "2026-03-17T12:00:00Z", gapMinutes: 25 },
    { mailbox: "info@genthrust.net", lastSuccessAt: null, gapMinutes: 0 },
  ];

  it("includes gap warnings section when gaps exist", () => {
    const card = buildDailyDigestCard(stats, gaps);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("Monitoring Gaps Detected");
    expect(bodyStr).toContain("ops@genthrust.net");
    expect(bodyStr).toContain("info@genthrust.net");
  });

  it("shows NEVER for mailbox with null lastSuccessAt", () => {
    const card = buildDailyDigestCard(stats, gaps);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("NEVER");
  });

  it("omits gap warnings section when no gaps", () => {
    const card = buildDailyDigestCard(stats, []);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).not.toContain("Monitoring Gaps Detected");
  });

  it("omits gap warnings section when gapWarnings is undefined", () => {
    const card = buildDailyDigestCard(stats);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).not.toContain("Monitoring Gaps Detected");
  });

  it("uses attention color for gap warning container", () => {
    const card = buildDailyDigestCard(stats, gaps);
    const bodyStr = JSON.stringify(card.body);
    expect(bodyStr).toContain("attention");
  });
});
