/**
 * Tests for Trigger.dev job definitions in trigger/
 * Verifies exports, task IDs, Zod schemas, and static config — no DB or network needed.
 */
import { describe, it, expect } from "vitest";

// --- excel-sync ---
import {
  syncRepairOrders,
  syncRepairOrdersPayloadSchema,
  type SyncRepairOrdersPayload,
} from "@/trigger/excel-sync";

// --- move-ro-sheet ---
import {
  moveRoSheet,
  moveRoSheetPayloadSchema,
  type MoveRoSheetPayload,
} from "@/trigger/move-ro-sheet";

// ============================================================
// excel-sync
// ============================================================

describe("syncRepairOrders task", () => {
  it("exports the syncRepairOrders task", () => {
    expect(syncRepairOrders).toBeDefined();
  });

  it("has the correct task id", () => {
    expect(syncRepairOrders.id).toBe("sync-repair-orders");
  });

  it("exports the syncRepairOrdersPayloadSchema", () => {
    expect(syncRepairOrdersPayloadSchema).toBeDefined();
  });
});

describe("syncRepairOrdersPayloadSchema validation", () => {
  it("accepts a valid payload", () => {
    const result = syncRepairOrdersPayloadSchema.safeParse({
      userId: "user-123",
      repairOrderIds: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty repairOrderIds array", () => {
    const result = syncRepairOrdersPayloadSchema.safeParse({
      userId: "user-123",
      repairOrderIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload missing repairOrderIds", () => {
    const result = syncRepairOrdersPayloadSchema.safeParse({
      userId: "user-123",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// move-ro-sheet
// ============================================================

describe("moveRoSheet task", () => {
  it("exports the moveRoSheet task", () => {
    expect(moveRoSheet).toBeDefined();
  });

  it("has the correct task id", () => {
    expect(moveRoSheet.id).toBe("move-ro-sheet");
  });

  it("exports the moveRoSheetPayloadSchema", () => {
    expect(moveRoSheetPayloadSchema).toBeDefined();
  });
});

describe("moveRoSheetPayloadSchema validation", () => {
  it("accepts a valid payload", () => {
    const valid: MoveRoSheetPayload = {
      userId: "user-abc",
      roId: 42,
      fromSheet: "Active",
      toSheet: "Net",
    };
    const result = moveRoSheetPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects payload missing roId", () => {
    const result = moveRoSheetPayloadSchema.safeParse({
      userId: "user-abc",
      fromSheet: "Active",
      toSheet: "Net",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with string roId", () => {
    const result = moveRoSheetPayloadSchema.safeParse({
      userId: "user-abc",
      roId: "not-a-number",
      fromSheet: "Active",
      toSheet: "Net",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload missing fromSheet", () => {
    const result = moveRoSheetPayloadSchema.safeParse({
      userId: "user-abc",
      roId: 42,
      toSheet: "Net",
    });
    expect(result.success).toBe(false);
  });
});
