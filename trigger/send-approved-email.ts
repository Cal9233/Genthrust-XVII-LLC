/**
 * Send Approved Email Task - Processes human-approved notifications
 * Ported from Genthrust_Repairs_v.2
 */

import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { notificationQueue, active } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getNotificationById,
  updateNotificationStatus,
  getEmailThreadForRO,
  updateNotificationOutlookIds,
} from "@/lib/data/notifications";
import { getShopEmailByName, updateShopEmail } from "@/lib/data/shops";
import {
  sendEmail,
  createToDoTask,
  createCalendarEvent,
} from "@/lib/graph/productivity";
import type {
  EmailDraftPayload,
  TaskReminderPayload,
} from "@/lib/types/notification";

export const sendApprovedEmailPayloadSchema = z.object({
  notificationId: z.number(),
  userId: z.string(),
  batchedNotificationIds: z.array(z.number()).optional(),
});

export type SendApprovedEmailPayload = z.infer<typeof sendApprovedEmailPayloadSchema>;

export const sendApprovedEmail = task({
  id: "send-approved-email",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }) => {
    const { notificationId } = payload as SendApprovedEmailPayload;
    await db
      .update(notificationQueue)
      .set({ status: "FAILED" })
      .where(eq(notificationQueue.id, notificationId));
  },
  run: async (payload: SendApprovedEmailPayload) => {
    const { notificationId, userId, batchedNotificationIds = [] } = payload;
    const isBatch = batchedNotificationIds.length > 0;

    const notification = await getNotificationById(notificationId);
    if (!notification) return { success: false, notificationId, action: "skipped" as const, error: "Not found" };
    if (notification.status !== "APPROVED") return { success: true, notificationId, action: "skipped" as const };

    if (notification.type === "EMAIL_DRAFT") {
      const emailPayload = notification.payload as EmailDraftPayload;
      const recipientAddress = (emailPayload.to || emailPayload.toAddress || "").trim();

      if (!recipientAddress) {
        await updateNotificationStatus(notificationId, "FAILED");
        return { success: false, notificationId, action: "failed" as const, error: "No recipient" };
      }

      const existingMessageId = await getEmailThreadForRO(notification.repairOrderId);

      const result = await sendEmail(userId, recipientAddress, emailPayload.subject, emailPayload.body, {
        cc: emailPayload.cc,
        replyToMessageId: existingMessageId ?? undefined,
      });

      await updateNotificationOutlookIds(notificationId, result.internetMessageId, result.conversationId);

      if (isBatch) {
        for (const siblingId of batchedNotificationIds) {
          await updateNotificationOutlookIds(siblingId, result.internetMessageId, result.conversationId);
        }
      }

      // Update shop email if changed
      if (recipientAddress && notification.repairOrderId) {
        try {
          const ro = await db.select({ shopName: active.shopName }).from(active).where(eq(active.id, notification.repairOrderId)).limit(1);
          if (ro[0]?.shopName) {
            const currentShopEmail = await getShopEmailByName(ro[0].shopName);
            if (!currentShopEmail || currentShopEmail.toLowerCase().trim() !== recipientAddress.toLowerCase().trim()) {
              await updateShopEmail(ro[0].shopName, recipientAddress);
            }
          }
        } catch {}
      }

      // Update RO dates
      const allRoIds: number[] = [];
      if (notification.repairOrderId) allRoIds.push(notification.repairOrderId);
      if (isBatch) {
        const siblings = await db.select({ repairOrderId: notificationQueue.repairOrderId }).from(notificationQueue).where(inArray(notificationQueue.id, batchedNotificationIds));
        for (const s of siblings) {
          if (s.repairOrderId && !allRoIds.includes(s.repairOrderId)) allRoIds.push(s.repairOrderId);
        }
      }

      if (allRoIds.length > 0) {
        try {
          const today = new Date();
          const nextFollowUp = new Date();
          nextFollowUp.setDate(today.getDate() + 7);
          const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

          await db.update(active).set({
            lastDateUpdated: formatDate(today),
            nextDateToUpdate: formatDate(nextFollowUp),
          }).where(inArray(active.id, allRoIds));

          await tasks.trigger("sync-repair-orders", { userId, repairOrderIds: allRoIds });
        } catch {}
      }
    } else if (notification.type === "TASK_REMINDER") {
      const taskPayload = notification.payload as TaskReminderPayload;
      const dueDate = new Date(taskPayload.dueDate);
      await Promise.all([
        createToDoTask(userId, taskPayload.title, dueDate, taskPayload.notes || ""),
        createCalendarEvent(userId, taskPayload.title, dueDate, dueDate, taskPayload.notes || ""),
      ]);
    }

    await updateNotificationStatus(notificationId, "SENT");

    if (isBatch && batchedNotificationIds.length > 0) {
      await db.update(notificationQueue).set({ status: "SENT" }).where(inArray(notificationQueue.id, batchedNotificationIds));
    }

    return { success: true, notificationId, action: "sent" as const };
  },
});
