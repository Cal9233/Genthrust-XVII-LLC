/**
 * RO Lifecycle Flow - Durable status-based follow-up automation
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { task, logger, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { active } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { insertNotificationCore } from "@/lib/data/notifications";
import { getShopEmailByName } from "@/lib/data/shops";
import {
  createCalendarEvent,
  createToDoTask,
} from "@/lib/graph/productivity";

export const roStatusChangePayloadSchema = z.object({
  repairOrderId: z.number(),
  newStatus: z.string(),
  oldStatus: z.string(),
  userId: z.string(),
});

export type RoStatusChangePayload = z.infer<typeof roStatusChangePayloadSchema>;

type StatusConfig = {
  waitDays: number;
  emailSubject: (roNumber: string | number, partNumber: string) => string;
  emailBody: (roNumber: string | number, partNumber: string) => string;
  reminderTitle: (roNumber: string | number, partNumber: string) => string;
  reminderBody: (roNumber: string | number, partNumber: string, shopName: string, droppedOff: string) => string;
};

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  "WAITING QUOTE": {
    waitDays: 7,
    emailSubject: (roNumber) => `Follow-up: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nJust checking in on RO# G${roNumber} for part ${partNumber}.\n\nWe'd love an update on the quote when you have a moment.\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Follow up on RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: WAITING QUOTE\nDropped Off: ${droppedOff}\n\nFollow up with the shop for a quote.`,
  },
  "APPROVED": {
    waitDays: 10,
    emailSubject: (roNumber) => `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nChecking in on the repair progress for RO# G${roNumber}, part ${partNumber}.\n\nPlease let us know if there are any updates or if you need anything from us.\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: APPROVED (payment sent)\nDropped Off: ${droppedOff}\n\nFollow up on repair progress.`,
  },
  "IN WORK": {
    waitDays: 10,
    emailSubject: (roNumber) => `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nChecking in on the repair progress for RO# G${roNumber}, part ${partNumber}.\n\nPlease let us know if there are any updates or if you need anything from us.\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: IN WORK\nDropped Off: ${droppedOff}\n\nFollow up on repair progress.`,
  },
  "IN PROGRESS": {
    waitDays: 10,
    emailSubject: (roNumber) => `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nChecking in on the repair progress for RO# G${roNumber}, part ${partNumber}.\n\nPlease let us know if there are any updates or if you need anything from us.\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: IN PROGRESS\nDropped Off: ${droppedOff}\n\nFollow up on repair progress.`,
  },
  "SHIPPED": {
    waitDays: 5,
    emailSubject: (roNumber) => `Tracking: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nCould you please provide tracking information for RO# G${roNumber}, part ${partNumber}?\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Check shipment: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: SHIPPED\nDropped Off: ${droppedOff}\n\nFollow up on shipment tracking.`,
  },
  "IN TRANSIT": {
    waitDays: 5,
    emailSubject: (roNumber) => `Tracking: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
      `Hi Team,\n\nCould you please provide tracking information for RO# G${roNumber}, part ${partNumber}?\n\nThanks!\nGenthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) => `Check shipment: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
      `Repair Order# G${roNumber}\nPart: ${partNumber}\nShop: ${shopName}\nStatus: IN TRANSIT\nDropped Off: ${droppedOff}\n\nFollow up on shipment tracking.`,
  },
};

export const handleRoStatusChange = task({
  id: "handle-ro-status-change",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 3 },
  run: async (payload: RoStatusChangePayload) => {
    const { repairOrderId, newStatus, oldStatus, userId } = payload;
    const normalizedStatus = newStatus.toUpperCase().trim();

    const config = STATUS_CONFIGS[normalizedStatus];
    if (!config) {
      return { success: true, action: "skipped" as const };
    }

    const [repairOrder] = await db
      .select()
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!repairOrder) {
      return { success: false, action: "failed" as const, error: "Repair order not found" };
    }

    // Phase 1: Immediate reminders
    const followUpDate = new Date(Date.now() + config.waitDays * 24 * 60 * 60 * 1000);
    const roNumber = repairOrder.ro ?? repairOrderId;
    const partNumber = repairOrder.part ?? "Unknown Part";
    const shopName = repairOrder.shopName ?? "Repair Shop";
    const droppedOff = repairOrder.dateDroppedOff ?? "N/A";

    const reminderTitle = config.reminderTitle(roNumber, partNumber);
    const reminderBody = config.reminderBody(roNumber, partNumber, shopName, droppedOff);

    try {
      await Promise.all([
        createCalendarEvent(userId, reminderTitle, followUpDate, followUpDate, reminderBody),
        createToDoTask(userId, reminderTitle, followUpDate, reminderBody),
      ]);
    } catch (error) {
      logger.warn("Failed to create reminders, continuing", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Phase 2: Durable wait
    await wait.for({ days: config.waitDays });

    // Phase 3: Re-validate
    const [currentRO] = await db
      .select()
      .from(active)
      .where(eq(active.id, repairOrderId))
      .limit(1);

    if (!currentRO) {
      return { success: true, action: "status_resolved" as const };
    }

    const currentStatus = currentRO.currentStatus?.toUpperCase().trim() ?? "";
    if (currentStatus !== normalizedStatus) {
      return { success: true, action: "status_resolved" as const };
    }

    // Phase 4: Generate email draft
    const currentRoNumber = currentRO.ro ?? repairOrderId;
    const currentPartNumber = currentRO.part ?? "Unknown";

    const emailSubject = config.emailSubject(currentRoNumber, currentPartNumber);
    const emailBody = config.emailBody(currentRoNumber, currentPartNumber);

    // Phase 5: Queue for approval
    const shopEmail = await getShopEmailByName(currentRO.shopName);
    const ccEmail = process.env.GENTHRUST_CC_EMAIL;

    if (!shopEmail) {
      return { success: true, action: "skipped" as const };
    }

    const notificationId = await insertNotificationCore({
      repairOrderId,
      userId,
      type: "EMAIL_DRAFT",
      payload: {
        to: shopEmail,
        cc: ccEmail,
        subject: emailSubject,
        body: emailBody,
      },
      scheduledFor: new Date(),
    });

    if (!notificationId) {
      return { success: false, action: "failed" as const, error: "Failed to queue email" };
    }

    return { success: true, action: "email_drafted" as const, notificationId };
  },
});
