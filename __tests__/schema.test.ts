/**
 * Tests for lib/db/schema.ts
 * Verifies table definitions and key column types exist without requiring a live DB.
 * Uses drizzle-orm table metadata.
 */
import { describe, it, expect } from "vitest";
import {
  active,
  net,
  paid,
  returns,
  inventoryindex,
  shops,
  users,
  accounts,
  sessions,
  notificationQueue,
  roStatusHistory,
  roActivityLog,
  filesUpload,
} from "@/lib/db/schema";

// Helper: get all column keys from a drizzle table
function columnNames(table: Record<string, unknown>): string[] {
  return Object.keys(table).filter(
    (k) => !k.startsWith("_") && typeof (table as any)[k] === "object"
  );
}

describe("active table schema", () => {
  it("exports the active table", () => {
    expect(active).toBeDefined();
  });

  it("has an id primary key column", () => {
    expect(active.id).toBeDefined();
  });

  it("has the currentStatus column (fixed from curentStatus)", () => {
    expect(active.currentStatus).toBeDefined();
  });

  it("has ro (repair order number) column", () => {
    expect(active.ro).toBeDefined();
  });

  it("has shopName column", () => {
    expect(active.shopName).toBeDefined();
  });

  it("has part column", () => {
    expect(active.part).toBeDefined();
  });

  it("has ERP sync columns", () => {
    expect(active.erpPoId).toBeDefined();
    expect(active.erpLastSyncAt).toBeDefined();
    expect(active.erpSyncStatus).toBeDefined();
  });

  it("has nextDateToUpdate column for overdue checking", () => {
    expect(active.nextDateToUpdate).toBeDefined();
  });
});

describe("net table schema", () => {
  it("exports the net table", () => {
    expect(net).toBeDefined();
  });

  it("has currentStatus column", () => {
    expect(net.currentStatus).toBeDefined();
  });

  it("has id primary key", () => {
    expect(net.id).toBeDefined();
  });
});

describe("paid table schema", () => {
  it("exports the paid table", () => {
    expect(paid).toBeDefined();
  });

  it("has id primary key", () => {
    expect(paid.id).toBeDefined();
  });
});

describe("returns table schema", () => {
  it("exports the returns table", () => {
    expect(returns).toBeDefined();
  });

  it("has id primary key", () => {
    expect(returns.id).toBeDefined();
  });
});

describe("inventoryindex table schema", () => {
  it("exports the inventoryindex table", () => {
    expect(inventoryindex).toBeDefined();
  });

  it("has indexId primary key", () => {
    expect(inventoryindex.indexId).toBeDefined();
  });

  it("has partNumber column", () => {
    expect(inventoryindex.partNumber).toBeDefined();
  });

  it("has tableName column", () => {
    expect(inventoryindex.tableName).toBeDefined();
  });

  it("has qty column", () => {
    expect(inventoryindex.qty).toBeDefined();
  });
});

describe("shops table schema", () => {
  it("exports the shops table", () => {
    expect(shops).toBeDefined();
  });

  it("has email column", () => {
    expect(shops.email).toBeDefined();
  });

  it("has businessName column", () => {
    expect(shops.businessName).toBeDefined();
  });
});

describe("users table schema", () => {
  it("exports the users table", () => {
    expect(users).toBeDefined();
  });

  it("has id column", () => {
    expect(users.id).toBeDefined();
  });

  it("has email column", () => {
    expect(users.email).toBeDefined();
  });

  it("has name column", () => {
    expect(users.name).toBeDefined();
  });
});

describe("notificationQueue table schema", () => {
  it("exports the notificationQueue table", () => {
    expect(notificationQueue).toBeDefined();
  });

  it("has id primary key", () => {
    expect(notificationQueue.id).toBeDefined();
  });

  it("has type column for notification type", () => {
    expect(notificationQueue.type).toBeDefined();
  });

  it("has status column", () => {
    expect(notificationQueue.status).toBeDefined();
  });

  it("has scheduledFor column", () => {
    expect(notificationQueue.scheduledFor).toBeDefined();
  });

  it("has outlookMessageId column", () => {
    expect(notificationQueue.outlookMessageId).toBeDefined();
  });
});

describe("roStatusHistory table schema", () => {
  it("exports the roStatusHistory table", () => {
    expect(roStatusHistory).toBeDefined();
  });

  it("has status column", () => {
    expect(roStatusHistory.status).toBeDefined();
  });

  it("has previousStatus column", () => {
    expect(roStatusHistory.previousStatus).toBeDefined();
  });
});

describe("roActivityLog table schema", () => {
  it("exports the roActivityLog table", () => {
    expect(roActivityLog).toBeDefined();
  });

  it("has action column", () => {
    expect(roActivityLog.action).toBeDefined();
  });

  it("has field column for tracking which field changed", () => {
    expect(roActivityLog.field).toBeDefined();
  });

  it("has oldValue and newValue columns", () => {
    expect(roActivityLog.oldValue).toBeDefined();
    expect(roActivityLog.newValue).toBeDefined();
  });
});

describe("filesUpload table schema", () => {
  it("exports the filesUpload table", () => {
    expect(filesUpload).toBeDefined();
  });

  it("has sharePointFileId column", () => {
    expect(filesUpload.sharePointFileId).toBeDefined();
  });

  it("has deletedAt column for soft deletes", () => {
    expect(filesUpload.deletedAt).toBeDefined();
  });
});
