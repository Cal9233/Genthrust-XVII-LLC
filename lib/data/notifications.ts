/**
 * Notification Queue data access functions
 * Ported from Genthrust_Repairs_v.2
 */

import { db } from "@/lib/db/index";
import { notificationQueue } from "@/lib/db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import type {
  NewNotificationQueueItem,
  NotificationQueueItem,
} from "@/lib/db/schema";

/**
 * Checks if a PENDING_APPROVAL notification already exists for a repair order
 */
export async function findExistingPendingNotification(
  repairOrderId: number
): Promise<number | null> {
  try {
    const [existing] = await db
      .select({ id: notificationQueue.id })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      )
      .limit(1);

    return existing?.id ?? null;
  } catch (error) {
    console.error("Error checking for existing notification:", error);
    return null;
  }
}

/**
 * Insert a new notification with deduplication
 */
export async function insertNotificationCore(
  data: Omit<NewNotificationQueueItem, "id" | "createdAt" | "status"> & {
    status?: NewNotificationQueueItem["status"];
  }
): Promise<number | null> {
  try {
    const targetStatus = data.status || "PENDING_APPROVAL";

    if (targetStatus === "PENDING_APPROVAL") {
      const existingId = await findExistingPendingNotification(
        data.repairOrderId
      );
      if (existingId) {
        return existingId;
      }
    }

    const insertResult = await db
      .insert(notificationQueue)
      .values({
        ...data,
        status: targetStatus,
      })
      .$returningId();
    const inserted = insertResult[0] as { id: number } | undefined;

    return inserted?.id ? Number(inserted.id) : null;
  } catch (error) {
    console.error("Error inserting notification core:", error);
    return null;
  }
}

/**
 * Fetch a notification by ID
 */
export async function getNotificationById(
  notificationId: number
): Promise<NotificationQueueItem | null> {
  try {
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.id, notificationId))
      .limit(1);

    return notification || null;
  } catch (error) {
    console.error("Error fetching notification:", error);
    return null;
  }
}

/**
 * Update a notification's status
 */
export async function updateNotificationStatus(
  notificationId: number,
  status: NewNotificationQueueItem["status"]
): Promise<boolean> {
  try {
    await db
      .update(notificationQueue)
      .set({ status })
      .where(eq(notificationQueue.id, notificationId));

    return true;
  } catch (error) {
    console.error("Error updating notification status:", error);
    return false;
  }
}

/**
 * Find the internetMessageId from the most recent sent email for an RO
 */
export async function getEmailThreadForRO(
  repairOrderId: number
): Promise<string | null> {
  try {
    const [sent] = await db
      .select({ outlookMessageId: notificationQueue.outlookMessageId })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.type, "EMAIL_DRAFT"),
          eq(notificationQueue.status, "SENT"),
          isNotNull(notificationQueue.outlookMessageId)
        )
      )
      .orderBy(desc(notificationQueue.createdAt))
      .limit(1);

    return sent?.outlookMessageId ?? null;
  } catch (error) {
    console.error("Error fetching email thread for RO:", error);
    return null;
  }
}

/**
 * Update notification with Outlook IDs after successful send
 */
export async function updateNotificationOutlookIds(
  notificationId: number,
  messageId: string,
  conversationId: string
): Promise<boolean> {
  try {
    await db
      .update(notificationQueue)
      .set({
        outlookMessageId: messageId,
        outlookConversationId: conversationId,
      })
      .where(eq(notificationQueue.id, notificationId));

    return true;
  } catch (error) {
    console.error("Error updating notification Outlook IDs:", error);
    return false;
  }
}
