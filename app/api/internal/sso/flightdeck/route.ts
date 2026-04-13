import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateSsoToken, buildFlightDeckSsoUrl } from "@/lib/sso-redirect";

export const dynamic = "force-dynamic";

// Maps XVII-LLC roles to FlightDeck roles (staff only — client role is excluded)
const ROLE_MAP = {
  admin: "owner",
  internal: "sales",
} as const;

export async function GET() {
  if (!process.env.ENTRA_TENANT_ID) {
    return NextResponse.json({ error: "SSO not configured" }, { status: 500 });
  }

  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user || !role || !(role in ROLE_MAP)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.email || !session.user.name) {
    return NextResponse.json({ error: "Incomplete session" }, { status: 401 });
  }

  const token = generateSsoToken({
    email: session.user.email,
    name: session.user.name,
    role: ROLE_MAP[role as keyof typeof ROLE_MAP],
    tenantId: process.env.ENTRA_TENANT_ID!,
  });

  return NextResponse.redirect(buildFlightDeckSsoUrl(token));
}
