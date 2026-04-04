// NOTE: MFA routes are NOT proxied to genthrust-ai.
// They depend on XVII-LLC's MySQL portal_users/mfa_factors schema with AES-256-GCM
// encrypted secrets and integer PKs. Proxying requires genthrust-ai to implement
// equivalent schema + MFA_ENCRYPTION_KEY sharing. Keep direct MySQL until that migration.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "client") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const users = await query<{ mfa_enabled: number }[]>(
      `SELECT mfa_enabled FROM portal_users WHERE id = ?`,
      [userId]
    );

    const enabled = users.length > 0 && users[0].mfa_enabled === 1;

    let recoveryCodesRemaining = 0;
    if (enabled) {
      const result = await query<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL AND deleted_at IS NULL`,
        [userId]
      );
      recoveryCodesRemaining = result[0]?.count ?? 0;
    }

    return NextResponse.json({ enabled, recoveryCodesRemaining });
  } catch (error) {
    console.error("MFA status error:", error);
    return NextResponse.json({ error: "Failed to get MFA status" }, { status: 500 });
  }
}
