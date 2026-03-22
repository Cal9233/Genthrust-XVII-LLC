/**
 * AI Tool Tasks - Durable Trigger.dev tasks called from AI chat
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db/index";
import {
  active,
  inventoryindex,
  notificationQueue,
  roActivityLog,
} from "@/lib/db/schema";
import { eq, like, or, max } from "drizzle-orm";
import { createDraftEmail } from "@/lib/graph/productivity";
import { TRACKED_STATUSES } from "@/lib/constants/statuses";

export type InventoryItem = typeof inventoryindex.$inferSelect;
export type RepairOrder = typeof active.$inferSelect;

export const searchInventoryTool = task({
  id: "ai-tool-search-inventory",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { query: string; limit?: number }) => {
    const { query, limit = 20 } = payload;
    const pattern = `%${query}%`;
    const results = await db
      .select()
      .from(inventoryindex)
      .where(
        or(
          like(inventoryindex.partNumber, pattern),
          like(inventoryindex.description, pattern)
        )
      )
      .limit(limit);
    return { items: results, count: results.length };
  },
});

export const getRepairOrderTool = task({
  id: "ai-tool-get-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { roNumber?: number; roId?: number }) => {
    const { roNumber, roId } = payload;
    let results: RepairOrder[];
    if (roId) {
      results = await db.select().from(active).where(eq(active.id, roId));
    } else if (roNumber) {
      results = await db.select().from(active).where(eq(active.ro, roNumber));
    } else {
      return { repairOrder: null, error: "Must provide roNumber or roId" };
    }
    return { repairOrder: results[0] ?? null };
  },
});

export const createRepairOrderTool = task({
  id: "ai-tool-create-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    shopName: string;
    part: string;
    serial?: string;
    partDescription?: string;
    reqWork?: string;
    estimatedCost?: number;
  }) => {
    const {
      userId,
      shopName,
      part,
      serial,
      partDescription,
      reqWork,
      estimatedCost,
    } = payload;

    const [maxRO] = await db.select({ maxRo: max(active.ro) }).from(active);
    const nextRO = Math.floor((maxRO?.maxRo ?? 0) + 1);

    const today = new Date().toISOString().split("T")[0];
    const insertData = {
      ro: nextRO,
      dateMade: today,
      shopName,
      part,
      serial: serial ?? null,
      partDescription: partDescription ?? null,
      reqWork: reqWork ?? null,
      estimatedCost: estimatedCost ?? null,
      currentStatus: "WAITING QUOTE",
      currentStatusDate: today,
      lastDateUpdated: today,
      nextDateToUpdate: today,
    };

    const insertResult = await db
      .insert(active)
      .values(insertData)
      .$returningId();
    const result = insertResult[0] as { id: number } | undefined;

    if (!result?.id) {
      throw new Error("Failed to create repair order");
    }

    await db.insert(roActivityLog).values({
      repairOrderId: result.id,
      action: "CREATE",
      field: null,
      oldValue: null,
      newValue: `Created RO #${nextRO} via AI Assistant`,
      userId,
    });

    try {
      await tasks.trigger("sync-repair-orders", {
        userId,
        repairOrderIds: [result.id],
      });
    } catch (e) {
      logger.error("Failed to trigger Excel sync for new RO", { error: e });
    }

    return { success: true, id: result.id, ro: nextRO };
  },
});

export const updateRepairOrderTool = task({
  id: "ai-tool-update-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    fields: {
      shopName?: string;
      part?: string;
      serial?: string | null;
      partDescription?: string | null;
      reqWork?: string | null;
      currentStatus?: string;
      currentStatusDate?: string | null;
      estimatedDeliveryDate?: string | null;
      dateDroppedOff?: string | null;
      dateMade?: string | null;
      lastDateUpdated?: string | null;
      nextDateToUpdate?: string | null;
      estimatedCost?: number | null;
      finalCost?: number | null;
      terms?: string | null;
      shopRef?: string | null;
      trackingNumberPickingUp?: string | null;
      genthrustStatus?: string | null;
      shopStatus?: string | null;
      notes?: string | null;
    };
  }) => {
    const { userId, roNumber, fields } = payload;

    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      return { success: false, error: `RO #${roNumber} not found` };
    }

    const oldStatus = existing.currentStatus ?? "";
    let statusChanged = false;
    let newStatus = "";

    const today = new Date().toISOString().split("T")[0];
    const updateData: Record<string, unknown> = {};
    const changes: string[] = [];

    if (fields.shopName !== undefined) {
      updateData.shopName = fields.shopName;
      changes.push(`shop name: ${fields.shopName}`);
    }
    if (fields.part !== undefined) {
      updateData.part = fields.part;
      changes.push(`part: ${fields.part}`);
    }
    if (fields.serial !== undefined) {
      updateData.serial = fields.serial;
      changes.push(`serial: ${fields.serial ?? "removed"}`);
    }
    if (fields.partDescription !== undefined) {
      updateData.partDescription = fields.partDescription;
      changes.push("part description updated");
    }
    if (fields.reqWork !== undefined) {
      updateData.reqWork = fields.reqWork;
      changes.push("requested work updated");
    }
    if (fields.currentStatus !== undefined) {
      updateData.currentStatus = fields.currentStatus;
      updateData.currentStatusDate = fields.currentStatusDate ?? today;
      newStatus = fields.currentStatus;
      statusChanged =
        fields.currentStatus.toUpperCase().trim() !==
        oldStatus.toUpperCase().trim();
      changes.push(`status: ${fields.currentStatus}`);
    }
    if (fields.estimatedDeliveryDate !== undefined) {
      updateData.estimatedDeliveryDate = fields.estimatedDeliveryDate;
      changes.push(
        `delivery date: ${fields.estimatedDeliveryDate ?? "removed"}`
      );
    }
    if (fields.dateDroppedOff !== undefined) {
      updateData.dateDroppedOff = fields.dateDroppedOff;
    }
    if (fields.dateMade !== undefined) {
      updateData.dateMade = fields.dateMade;
    }
    if (fields.lastDateUpdated !== undefined) {
      updateData.lastDateUpdated = fields.lastDateUpdated;
    } else {
      updateData.lastDateUpdated = today;
    }
    if (fields.nextDateToUpdate !== undefined) {
      updateData.nextDateToUpdate = fields.nextDateToUpdate;
    }
    if (fields.estimatedCost !== undefined) {
      updateData.estimatedCost = fields.estimatedCost;
    }
    if (fields.finalCost !== undefined) {
      updateData.finalCost = fields.finalCost;
    }
    if (fields.terms !== undefined) {
      updateData.terms = fields.terms;
    }
    if (fields.shopRef !== undefined) {
      updateData.shopRef = fields.shopRef;
    }
    if (fields.trackingNumberPickingUp !== undefined) {
      updateData.trackingNumberPickingUp = fields.trackingNumberPickingUp;
    }
    if (fields.genthrustStatus !== undefined) {
      updateData.genthrustStatus = fields.genthrustStatus;
    }
    if (fields.shopStatus !== undefined) {
      updateData.shopStatus = fields.shopStatus;
    }
    if (fields.notes !== undefined) {
      updateData.notes = fields.notes;
      changes.push("notes updated");
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true, roNumber, updated: [], message: "No fields to update" };
    }

    await db.update(active).set(updateData).where(eq(active.id, existing.id));

    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "UPDATE",
      field: null,
      oldValue: null,
      newValue: `Updated via AI: ${changes.join(", ")}`,
      userId,
    });

    if (statusChanged && newStatus) {
      const normalizedNew = newStatus.toUpperCase().trim();
      if (TRACKED_STATUSES.some((s) => s === normalizedNew)) {
        try {
          await tasks.trigger("handle-ro-status-change", {
            repairOrderId: existing.id,
            newStatus: normalizedNew,
            oldStatus: oldStatus.toUpperCase().trim(),
            userId,
          });
        } catch (e) {
          logger.error("Failed to trigger lifecycle flow", { error: e });
        }
      }
    }

    try {
      await tasks.trigger("sync-repair-orders", {
        userId,
        repairOrderIds: [existing.id],
      });
    } catch (e) {
      logger.error("Failed to trigger Excel sync", { error: e });
    }

    return { success: true, roNumber, updated: changes };
  },
});

export const archiveRepairOrderTool = task({
  id: "ai-tool-archive-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    destination: "returns" | "paid" | "net";
    reason?: string;
  }) => {
    const { userId, roNumber, destination, reason } = payload;

    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      return { success: false, error: `RO #${roNumber} not found` };
    }

    const statusMap: Record<string, string> = {
      returns: "RETURN",
      paid: "COMPLETE",
      net: "COMPLETE",
    };
    const sheetMap: Record<string, string> = {
      returns: "Returns",
      paid: "Paid",
      net: "NET",
    };

    const today = new Date().toISOString().split("T")[0];
    await db
      .update(active)
      .set({
        currentStatus: statusMap[destination],
        currentStatusDate: today,
        lastDateUpdated: today,
        notes: reason
          ? `${existing.notes ? existing.notes + " | " : ""}Archived: ${reason}`
          : existing.notes,
      })
      .where(eq(active.id, existing.id));

    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "STATUS_CHANGE",
      field: "currentStatus",
      oldValue: existing.currentStatus,
      newValue: statusMap[destination],
      userId,
    });

    try {
      await tasks.trigger("move-ro-sheet", {
        userId,
        roId: existing.id,
        fromSheet: "Active",
        toSheet: sheetMap[destination],
      });
    } catch (e) {
      logger.error("Failed to trigger move-ro-sheet", { error: e });
    }

    return {
      success: true,
      roNumber,
      destination,
      sheet: sheetMap[destination],
    };
  },
});

export const createEmailDraftTool = task({
  id: "ai-tool-create-email-draft",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    toAddress: string;
    subject: string;
    body: string;
  }) => {
    const { userId, roNumber, toAddress, subject, body } = payload;

    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      return { success: false, error: `RO #${roNumber} not found` };
    }

    let draftResult;
    try {
      draftResult = await createDraftEmail(userId, toAddress, subject, body);
    } catch (e) {
      logger.error("Failed to create draft in Outlook", { error: e });
      return { success: false, error: "Failed to create draft in Outlook" };
    }

    await db.insert(notificationQueue).values({
      repairOrderId: existing.id,
      userId,
      type: "EMAIL_DRAFT",
      status: "PENDING_APPROVAL",
      payload: {
        subject,
        body,
        to: toAddress,
        draftMessageId: draftResult.messageId,
        draftWebLink: draftResult.webLink,
      },
      scheduledFor: new Date(),
    });

    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "DRAFT_CREATED",
      field: null,
      oldValue: null,
      newValue: `Email draft created for ${toAddress}: ${subject}`,
      userId,
    });

    return {
      success: true,
      roNumber,
      messageId: draftResult.messageId,
      webLink: draftResult.webLink,
    };
  },
});
