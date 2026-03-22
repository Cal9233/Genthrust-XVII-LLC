/**
 * Overdue Safety Net - Daily scheduled check for overdue ROs
 * Ported from Genthrust_Repairs_v.2 with currentStatus fix
 */

import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db/index";
import { active, users, notificationQueue } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { insertNotificationCore } from "@/lib/data/notifications";
import { getShopEmailByName } from "@/lib/data/shops";
import { isOverdue } from "@/lib/date-utils";

export const checkOverdueRos = schedules.task({
  id: "check-overdue-ros",
  cron: "0 8 * * *",
  machine: { preset: "small-1x" },
  run: async () => {
    // Step 1: Bump stale PENDING_APPROVAL notifications
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bumpResult = await db
      .update(notificationQueue)
      .set({ scheduledFor: new Date() })
      .where(
        and(
          eq(notificationQueue.status, "PENDING_APPROVAL"),
          lt(notificationQueue.scheduledFor, twentyFourHoursAgo)
        )
      );

    const bumpedCount = bumpResult[0]?.affectedRows ?? 0;
    logger.info(`Bumped ${bumpedCount} stale notifications`);

    // Step 2: Find overdue ROs
    const allActiveROs = await db
      .select({
        id: active.id,
        ro: active.ro,
        part: active.part,
        shopName: active.shopName,
        nextDateToUpdate: active.nextDateToUpdate,
        currentStatus: active.currentStatus,
      })
      .from(active);

    const overdueROs = allActiveROs.filter((ro) =>
      isOverdue(ro.nextDateToUpdate)
    );

    if (overdueROs.length === 0) {
      return { bumped: bumpedCount, processed: 0 };
    }

    // Step 3: Create notifications
    const [defaultUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!defaultUser) {
      return { bumped: bumpedCount, processed: 0, error: "No users found" };
    }

    let processed = 0;
    const ccEmail = process.env.GENTHRUST_CC_EMAIL;

    for (const ro of overdueROs) {
      try {
        const shopEmail = await getShopEmailByName(ro.shopName);
        const roNumber = ro.ro ?? ro.id;
        const partNumber = ro.part ?? "Unknown Part";

        const notificationId = await insertNotificationCore({
          repairOrderId: ro.id,
          userId: defaultUser.id,
          type: "EMAIL_DRAFT",
          payload: {
            to: shopEmail || "",
            cc: ccEmail,
            subject: `Follow-up: RO# G${roNumber}`,
            body: `Hi Team,\n\nJust checking in on RO# G${roNumber} for part ${partNumber}.\n\nWe'd love an update when you have a moment.\n\nThanks!\nGenthrust XVII, LLC`,
            missingEmail: !shopEmail,
            shopName: ro.shopName ?? undefined,
          },
          scheduledFor: new Date(),
        });

        if (notificationId) processed++;
      } catch (error) {
        logger.error(`Failed to process RO ${ro.id}`, { error });
      }
    }

    return { bumped: bumpedCount, processed, total: overdueROs.length };
  },
});
