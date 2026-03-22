/**
 * Email Send API - Triggers sending of approved notifications via shared mailbox
 * Ported from Genthrust_Repairs_v.2
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from "@/lib/audit-logger";
import { z } from "zod";

const SendEmailSchema = z.object({
  notificationId: z.number().int().positive(),
  batchedNotificationIds: z.array(z.number().int().positive()).optional().default([]),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SendEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { notificationId, batchedNotificationIds } = parsed.data;

    const handle = await tasks.trigger("send-approved-email", {
      notificationId,
      userId: session.user.id,
      batchedNotificationIds,
    });

    logAuditEvent({
      action: ACTION_TYPES.SEND_EMAIL,
      resource_type: RESOURCE_TYPES.EMAIL,
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: 'internal',
      success: true,
      status_code: 200,
      metadata: { notificationId, batchCount: batchedNotificationIds.length, taskId: handle.id },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      message: "Email send task queued",
    });
  } catch (error) {
    console.error('Email send error:', error instanceof Error ? { message: error.message } : error);
    return NextResponse.json({ error: 'Failed to queue email send' }, { status: 500 });
  }
}
