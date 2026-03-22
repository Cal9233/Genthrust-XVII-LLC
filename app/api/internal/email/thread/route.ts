/**
 * Email Thread API - Fetches conversation thread for a repair order
 * Ported from Genthrust_Repairs_v.2
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversationMessages } from "@/lib/graph/productivity";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 }
    );
  }

  try {
    const messages = await getConversationMessages(
      session.user.id,
      conversationId
    );
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch email thread:", error);
    return NextResponse.json(
      {
        messages: [],
        graphError: true,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 } // Return 200 with error flag for graceful degradation
    );
  }
}
