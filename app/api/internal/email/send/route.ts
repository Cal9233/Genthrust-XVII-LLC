/**
 * Email Send API - Triggers sending of approved notifications via shared mailbox
 * Ported from Genthrust_Repairs_v.2
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from "@/lib/audit-logger";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notificationId, batchedNotificationIds } = await req.json();

  if (!notificationId || typeof notificationId !== "number") {
    return NextResponse.json(
      { error: "notificationId is required" },
      { status: 400 }
    );
  }

  const handle = await tasks.trigger("send-approved-email", {
    notificationId,
    userId: session.user.id,
    batchedNotificationIds: batchedNotificationIds ?? [],
  });

  logAuditEvent({
    action: ACTION_TYPES.SEND_EMAIL,
    resource_type: RESOURCE_TYPES.EMAIL,
    user_id: session.user.id,
    user_email: session.user.email ?? null,
    user_role: 'internal',
    success: true,
    status_code: 200,
    metadata: { notificationId, batchCount: batchedNotificationIds?.length ?? 0, taskId: handle.id },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    taskId: handle.id,
    message: "Email send task queued",
  });
}
