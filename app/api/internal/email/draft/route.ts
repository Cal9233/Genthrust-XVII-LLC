/**
 * Email Draft API - Creates email drafts in Outlook via shared mailbox
 * Ported from Genthrust_Repairs_v.2
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDraftEmail } from "@/lib/graph/productivity";
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from "@/lib/audit-logger";
import { sanitizeEmailBody } from "@/lib/sanitize-html-body";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { to, subject, body } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof to !== 'string' || !emailRegex.test(to)) {
    return NextResponse.json(
      { error: "Invalid email address format" },
      { status: 400 }
    );
  }

  // Validate subject and body lengths
  if (typeof subject !== 'string' || subject.length === 0 || subject.length > 500) {
    return NextResponse.json(
      { error: "Subject must be a non-empty string (max 500 characters)" },
      { status: 400 }
    );
  }
  if (typeof body !== 'string' || body.length === 0 || body.length > 50000) {
    return NextResponse.json(
      { error: "Body must be a non-empty string (max 50000 characters)" },
      { status: 400 }
    );
  }

  // Sanitize HTML body — strip dangerous tags, URIs, and event handlers
  const sanitizedBody = sanitizeEmailBody(body);

  try {
    const result = await createDraftEmail(session.user.id, to, subject, sanitizedBody);

    logAuditEvent({
      action: ACTION_TYPES.SEND_EMAIL,
      resource_type: RESOURCE_TYPES.EMAIL,
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      user_role: 'internal',
      success: true,
      status_code: 200,
      metadata: { to, subject, type: 'draft' },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      webLink: result.webLink,
    });
  } catch (error) {
    console.error("Failed to create email draft:", error);
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 }
    );
  }
}
