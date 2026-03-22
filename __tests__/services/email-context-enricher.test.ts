/**
 * Tests for email-context-enricher.ts
 *
 * Validates RO number extraction, part number matching, shop domain recognition,
 * To-Do task cross-referencing, DB error isolation, and malformed input handling.
 *
 * All DB calls are mocked — no real database needed.
 * Note on call ordering: findRoMatches and findShopMatch run via Promise.all.
 * findRoMatches always calls query() FIRST (before findShopMatch) because it
 * hits its await before findShopMatch does in JS single-threaded execution.
 * Exception: if conditions.length === 0, findRoMatches returns early WITHOUT querying.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichEmailContext } from "@/lib/services/email-context-enricher";
import type {
  TodoTask,
  ActiveRO,
  Shop,
} from "@/lib/services/email-context-enricher";
import * as dbModule from "@/lib/db";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(dbModule.query);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmail(from: string, subject: string, bodyPreview: string) {
  return { from, subject, bodyPreview };
}

function makeRO(overrides: Partial<ActiveRO> = {}): ActiveRO {
  return {
    ro: 4521,
    shopName: "Heliparts Inc",
    part: "206-011-114-001",
    serial: null,
    partDescription: "Main Rotor Hub",
    reqWork: null,
    estimatedCost: 5000,
    finalCost: null,
    shopStatus: "AWAITING QUOTE",
    ...overrides,
  };
}

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    businessName: "Heliparts Inc",
    email: "purchasing@heliparts.com",
    contact: "John Smith",
    paymentTerms: "Net 30",
    ...overrides,
  };
}

function makeTodoTask(overrides: Partial<TodoTask> = {}): TodoTask {
  return {
    id: "task-1",
    title: "[GenThrust] Follow up with vendor",
    body: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// RO number matching
// ---------------------------------------------------------------------------

describe("enrichEmailContext — RO number matching", () => {
  it("matches 'RO #4521' in subject and returns the DB result", async () => {
    const ro = makeRO();
    // findRoMatches query: returns match (conditions: RO=?, SHOP_NAME LIKE ?)
    mockQuery.mockResolvedValueOnce([ro] as any);
    // findShopMatch query: no match
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail(
      "vendor@heliparts.com",
      "RE: RO #4521 - Quote Ready",
      ""
    );
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
    expect(result.roMatches[0].ro).toBe(4521);
    expect(result.roMatches[0].shopName).toBe("Heliparts Inc");
  });

  it("matches 'RO4521' without space or hash", async () => {
    const ro = makeRO();
    mockQuery.mockResolvedValueOnce([ro] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail("vendor@heliparts.com", "RO4521 Status Update", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
  });

  it("matches 'RO# 4521' with hash before space", async () => {
    const ro = makeRO();
    mockQuery.mockResolvedValueOnce([ro] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail("vendor@heliparts.com", "Ref RO# 4521", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
  });

  it("extracts multiple RO numbers and returns all DB matches", async () => {
    const ros = [makeRO({ ro: 4521 }), makeRO({ ro: 4522, shopName: "Shop B" })];
    mockQuery.mockResolvedValueOnce(ros as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail(
      "vendor@heliparts.com",
      "RE: RO #4521 and RO #4522",
      ""
    );
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(2);
  });

  it("returns empty roMatches when no RO/part numbers and short domain (no DB query for RO)", async () => {
    // from "vendor@ab.com" → domainBase "ab" (2 chars, < 3) → no condition → no RO query
    // Only the shop query fires
    mockQuery.mockResolvedValueOnce([] as any); // shop query

    const email = makeEmail("vendor@ab.com", "General inquiry", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(0);
    // Only 1 DB call (shop query), not 2
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Part number matching
// ---------------------------------------------------------------------------

describe("enrichEmailContext — part number matching", () => {
  it("matches 'P/N 206-011-114-001' in subject", async () => {
    const ro = makeRO({ part: "206-011-114-001" });
    mockQuery.mockResolvedValueOnce([ro] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail(
      "vendor@supplier.com",
      "Quote for P/N 206-011-114-001",
      ""
    );
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
  });

  it("matches dash-separated part number without P/N prefix", async () => {
    const ro = makeRO({ part: "3G2750-100191" });
    mockQuery.mockResolvedValueOnce([ro] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail(
      "vendor@supplier.com",
      "Availability of 3G2750-100191",
      ""
    );
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
  });

  it("matches part number in bodyPreview (not just subject)", async () => {
    const ro = makeRO();
    mockQuery.mockResolvedValueOnce([ro] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail(
      "vendor@supplier.com",
      "Quotation",
      "Part 206-011-114-001 is available"
    );
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Shop/vendor recognition
// ---------------------------------------------------------------------------

describe("enrichEmailContext — shop matching", () => {
  it("matches sender domain against shops table", async () => {
    const shop = makeShop();
    // Domain "heliparts.com" → base "heliparts" >= 3 → RO query fires
    mockQuery.mockResolvedValueOnce([] as any); // RO query (no RO numbers → domain match only)
    mockQuery.mockResolvedValueOnce([shop] as any); // shop query

    const email = makeEmail("purchasing@heliparts.com", "General inquiry", "");
    const result = await enrichEmailContext(email, []);

    expect(result.shopMatch).not.toBeNull();
    expect(result.shopMatch?.businessName).toBe("Heliparts Inc");
    expect(result.shopMatch?.contact).toBe("John Smith");
    expect(result.shopMatch?.paymentTerms).toBe("Net 30");
  });

  it("returns null shopMatch when sender domain not in shops table", async () => {
    mockQuery.mockResolvedValueOnce([] as any); // RO query
    mockQuery.mockResolvedValueOnce([] as any); // shop query — no match

    const email = makeEmail("info@unknownvendor.com", "Hello", "");
    const result = await enrichEmailContext(email, []);

    expect(result.shopMatch).toBeNull();
  });

  it("returns null shopMatch when from address has no @ symbol", async () => {
    // No domain to extract → findShopMatch returns null without querying
    // But findRoMatches also has no conditions → skips DB
    // So zero DB calls total

    const email = makeEmail("no-email", "Subject", "");
    const result = await enrichEmailContext(email, []);

    expect(result.shopMatch).toBeNull();
    // No DB queries since no domain and no RO/part numbers
  });
});

// ---------------------------------------------------------------------------
// To-Do cross-referencing
// ---------------------------------------------------------------------------

describe("enrichEmailContext — To-Do cross-referencing", () => {
  it("matches task by sender name appearing in task text", async () => {
    // Use domain base that doesn't appear in task to isolate sender name match
    mockQuery.mockResolvedValueOnce([] as any); // RO query (domain "acme-corp" >= 3)
    mockQuery.mockResolvedValueOnce([] as any); // shop query

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-1",
        title: "[GenThrust] Follow up with Acme Corp about PO",
        body: "",
      }),
    ];

    // senderName = "Acme Corp" → lowercase "acme corp"
    // domainBase = "acme-corp" → NOT in task text
    // "acme corp" IS in task text → match by sender name
    const email = makeEmail(
      "Acme Corp <billing@acme-corp.com>",
      "Invoice",
      ""
    );
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
    expect(result.todoMatches[0].id).toBe("task-1");
  });

  it("matches task by domain base appearing in task text", async () => {
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-2",
        title: "[GenThrust] Check on heliparts shipment status",
        body: "",
      }),
    ];

    // domainBase = "heliparts" → in task text → match
    const email = makeEmail("unknown@heliparts.com", "Shipment update", "");
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
    expect(result.todoMatches[0].id).toBe("task-2");
  });

  it("matches task by RO number in email subject", async () => {
    // RO 4521 in subject → extracted → matched against task text
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-3",
        title: "[GenThrust] Check 4521 repair status",
        body: "",
      }),
    ];

    // domainBase "anyshop" >= 3 → adds condition → RO query fires
    const email = makeEmail(
      "vendor@anyshop.com",
      "RE: RO #4521 Update",
      ""
    );
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
  });

  it("matches task by part number appearing in task body", async () => {
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-4",
        title: "[GenThrust] Source 206-011-114-001",
        body: "Need this part urgently",
      }),
    ];

    const email = makeEmail(
      "vendor@supplier.com",
      "Quote for P/N 206-011-114-001",
      ""
    );
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
  });

  it("matches task by shop name from RO context", async () => {
    const ro = makeRO({ shopName: "Premier MRO" });
    mockQuery.mockResolvedValueOnce([ro] as any); // RO query
    mockQuery.mockResolvedValueOnce([] as any); // shop query

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-5",
        title: "[GenThrust] Get quote from premier mro for landing gear",
        body: "",
      }),
    ];

    const email = makeEmail(
      "vendor@heliparts.com",
      "RE: RO #4521",
      ""
    );
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
    expect(result.todoMatches[0].id).toBe("task-5");
  });

  it("returns empty todoMatches when tasks array is empty", async () => {
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const email = makeEmail("vendor@supplier.com", "Hello", "");
    const result = await enrichEmailContext(email, []);

    expect(result.todoMatches).toHaveLength(0);
  });

  it("does not return duplicate task matches", async () => {
    // A task that would match by BOTH domain base AND sender name
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const tasks: TodoTask[] = [
      makeTodoTask({
        id: "task-dedup",
        title: "[GenThrust] heliparts aviation follow up",
        body: "",
      }),
    ];

    // "Heliparts Aviation" → senderName "heliparts aviation" → matches
    // domainBase "heliparts" → also in task text → matches again
    // Should only appear once in results
    const email = makeEmail(
      "Heliparts Aviation <info@heliparts.com>",
      "Re: Quote",
      ""
    );
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Malformed / empty inputs
// ---------------------------------------------------------------------------

describe("enrichEmailContext — malformed inputs don't crash", () => {
  it("handles empty from, subject, and bodyPreview without throwing", async () => {
    // No domain → no shop query; no conditions → no RO query
    const email = makeEmail("", "", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(0);
    expect(result.todoMatches).toHaveLength(0);
    expect(result.shopMatch).toBeNull();
    // No DB calls should have been made
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("handles whitespace-only subject and bodyPreview", async () => {
    // domain "x.com" → base "x" (1 char, < 3) → no conditions → no RO query
    // But shop query still fires for non-empty domain
    mockQuery.mockResolvedValueOnce([] as any); // shop query

    const email = makeEmail("sender@x.com", "   ", "   ");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(0);
    expect(result.shopMatch).toBeNull();
  });

  it("handles tasks array with empty title without crashing", async () => {
    mockQuery.mockResolvedValueOnce([] as any);
    mockQuery.mockResolvedValueOnce([] as any);

    const tasks: TodoTask[] = [makeTodoTask({ title: "", body: "" })];

    const email = makeEmail("vendor@supplier.com", "Hello", "");
    const result = await enrichEmailContext(email, tasks);

    expect(result.todoMatches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DB error isolation
// ---------------------------------------------------------------------------

describe("enrichEmailContext — DB error isolation", () => {
  it("returns empty roMatches when RO query throws, other context still works", async () => {
    const shop = makeShop();
    // findRoMatches fails, findShopMatch succeeds
    mockQuery
      .mockRejectedValueOnce(new Error("DB connection lost")) // RO query
      .mockResolvedValueOnce([shop] as any); // shop query

    const email = makeEmail("vendor@heliparts.com", "RO #4521 Status", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(0); // isolated failure
    expect(result.shopMatch?.businessName).toBe("Heliparts Inc"); // still works
  });

  it("returns null shopMatch when shop query throws", async () => {
    const ro = makeRO();
    mockQuery
      .mockResolvedValueOnce([ro] as any) // RO query succeeds
      .mockRejectedValueOnce(new Error("Timeout")); // shop query fails

    const email = makeEmail("vendor@heliparts.com", "RO #4521 Update", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1); // still works
    expect(result.shopMatch).toBeNull(); // isolated failure
  });
});

// ---------------------------------------------------------------------------
// Parallel execution
// ---------------------------------------------------------------------------

describe("enrichEmailContext — runs RO and shop queries in parallel", () => {
  it("returns context from both sources when both match", async () => {
    const ro = makeRO();
    const shop = makeShop();
    mockQuery
      .mockResolvedValueOnce([ro] as any) // RO query
      .mockResolvedValueOnce([shop] as any); // shop query

    const email = makeEmail("vendor@heliparts.com", "RO #4521 Quote Ready", "");
    const result = await enrichEmailContext(email, []);

    expect(result.roMatches).toHaveLength(1);
    expect(result.shopMatch).not.toBeNull();
  });
});
