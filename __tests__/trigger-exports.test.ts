/**
 * Tests for Trigger.dev job definitions in trigger/
 * Verifies exports, task IDs, Zod schemas, and static config — no DB or network needed.
 */
import { describe, it, expect } from "vitest";

// --- ro-lifecycle-flow ---
import {
  handleRoStatusChange,
  roStatusChangePayloadSchema,
  type RoStatusChangePayload,
} from "@/trigger/ro-lifecycle-flow";

// --- send-approved-email ---
import {
  sendApprovedEmail,
  sendApprovedEmailPayloadSchema,
  type SendApprovedEmailPayload,
} from "@/trigger/send-approved-email";

// --- excel-sync ---
import {
  syncRepairOrders,
  syncRepairOrdersPayloadSchema,
  type SyncRepairOrdersPayload,
} from "@/trigger/excel-sync";

// --- check-overdue-ros ---
import { checkOverdueRos } from "@/trigger/check-overdue-ros";

// --- ai-tools ---
import {
  searchInventoryTool,
  getRepairOrderTool,
  createRepairOrderTool,
  updateRepairOrderTool,
  archiveRepairOrderTool,
  createEmailDraftTool,
} from "@/trigger/ai-tools";

// ============================================================
// ro-lifecycle-flow
// ============================================================

describe("handleRoStatusChange task", () => {
  it("exports the handleRoStatusChange task", () => {
    expect(handleRoStatusChange).toBeDefined();
  });

  it("has the correct task id", () => {
    expect(handleRoStatusChange.id).toBe("handle-ro-status-change");
  });

  it("exports a valid Zod schema for RoStatusChangePayload", () => {
    expect(roStatusChangePayloadSchema).toBeDefined();
  });
});

describe("roStatusChangePayloadSchema validation", () => {
  it("accepts a valid payload", () => {
    const valid: RoStatusChangePayload = {
      repairOrderId: 42,
      newStatus: "WAITING QUOTE",
      oldStatus: "DRAFT",
      userId: "user-abc",
    };
    const result = roStatusChangePayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects payload missing repairOrderId", () => {
    const result = roStatusChangePayloadSchema.safeParse({
      newStatus: "WAITING QUOTE",
      oldStatus: "DRAFT",
      userId: "user-abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with non-numeric repairOrderId", () => {
    const result = roStatusChangePayloadSchema.safeParse({
      repairOrderId: "not-a-number",
      newStatus: "WAITING QUOTE",
      oldStatus: "DRAFT",
      userId: "user-abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload missing userId", () => {
    const result = roStatusChangePayloadSchema.safeParse({
      repairOrderId: 1,
      newStatus: "APPROVED",
      oldStatus: "WAITING QUOTE",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// send-approved-email
// ============================================================

describe("sendApprovedEmail task", () => {
  it("exports the sendApprovedEmail task", () => {
    expect(sendApprovedEmail).toBeDefined();
  });

  it("has the correct task id", () => {
    expect(sendApprovedEmail.id).toBe("send-approved-email");
  });

  it("exports the sendApprovedEmailPayloadSchema", () => {
    expect(sendApprovedEmailPayloadSchema).toBeDefined();
  });
});

describe("sendApprovedEmailPayloadSchema validation", () => {
  it("accepts a minimal valid payload (no batch)", () => {
    const result = sendApprovedEmailPayloadSchema.safeParse({
      notificationId: 7,
      userId: "user-xyz",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with optional batchedNotificationIds", () => {
    const result = sendApprovedEmailPayloadSchema.safeParse({
      notificationId: 7,
      userId: "user-xyz",
      batchedNotificationIds: [8, 9, 10],
    });
    expect(result.success).toBe(true);
  });

  it("rejects payload missing notificationId", () => {
    const result = sendApprovedEmailPayloadSchema.safeParse({
      userId: "user-xyz",
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with non-number in batchedNotificationIds", () => {
    const result = sendApprovedEmailPayloadSchema.safeParse({
      notificationId: 7,
      userId: "user-xyz",
      batchedNotificationIds: ["not-a-number"],
    });
    expect(result.success).toBe(false);
  });
});

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
// check-overdue-ros
// ============================================================

describe("checkOverdueRos scheduled task", () => {
  it("exports the checkOverdueRos task", () => {
    expect(checkOverdueRos).toBeDefined();
  });

  it("has the correct task id", () => {
    expect(checkOverdueRos.id).toBe("check-overdue-ros");
  });
});

// ============================================================
// ai-tools
// ============================================================

describe("AI tool tasks exports", () => {
  it("exports searchInventoryTool with correct id", () => {
    expect(searchInventoryTool).toBeDefined();
    expect(searchInventoryTool.id).toBe("ai-tool-search-inventory");
  });

  it("exports getRepairOrderTool with correct id", () => {
    expect(getRepairOrderTool).toBeDefined();
    expect(getRepairOrderTool.id).toBe("ai-tool-get-repair-order");
  });

  it("exports createRepairOrderTool with correct id", () => {
    expect(createRepairOrderTool).toBeDefined();
    expect(createRepairOrderTool.id).toBe("ai-tool-create-repair-order");
  });

  it("exports updateRepairOrderTool with correct id", () => {
    expect(updateRepairOrderTool).toBeDefined();
    expect(updateRepairOrderTool.id).toBe("ai-tool-update-repair-order");
  });

  it("exports archiveRepairOrderTool with correct id", () => {
    expect(archiveRepairOrderTool).toBeDefined();
    expect(archiveRepairOrderTool.id).toBe("ai-tool-archive-repair-order");
  });

  it("exports createEmailDraftTool with correct id", () => {
    expect(createEmailDraftTool).toBeDefined();
    expect(createEmailDraftTool.id).toBe("ai-tool-create-email-draft");
  });
});
