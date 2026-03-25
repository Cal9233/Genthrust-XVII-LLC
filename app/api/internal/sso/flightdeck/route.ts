import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateSsoToken, buildFlightDeckSsoUrl } from "@/lib/sso-redirect";

export const dynamic = "force-dynamic";

// Role mapping: XVII-LLC role → FlightDeck role
const ROLE_MAP: Record<string, string> = {
  admin: "owner",
  internal: "sales",
  client: "viewer",
};

export async function GET() {
  if (!process.env.ENTRA_TENANT_ID) {
    return NextResponse.json({ error: "SSO not configured" }, { status: 500 });
  }

  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;

  if (!session?.user || !role || !ROLE_MAP[role]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.email || !session.user.name) {
    return NextResponse.json({ error: "Incomplete session" }, { status: 401 });
  }

  const flightDeckRole = ROLE_MAP[role];

  // For client portal users, pass their erpContactId so FlightDeck can scope
  // their data access to their customer record. The integer maps to
  // airdata_customers.airdata_customer_id on the FlightDeck side.
  const erpContactId = (session.user as any)?.erpContactId as number | null | undefined;

  const token = generateSsoToken({
    email: session.user.email,
    name: session.user.name,
    role: flightDeckRole,
    tenantId: process.env.ENTRA_TENANT_ID!,
    ...(role === "client" && erpContactId ? { erpContactId } : {}),
  });

  return NextResponse.redirect(buildFlightDeckSsoUrl(token));
}
