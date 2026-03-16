/**
 * Microsoft Graph API client and Excel session management
 * Ported from Genthrust_Repairs_v.2 - adapted for dashboard paths
 */

import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { db } from "@/lib/db/index";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { TokenResponse, ExcelSession } from "@/lib/types/graph";
import { UserNotConnectedError, TokenRefreshError } from "@/lib/types/graph";

/**
 * Build the Graph API base path for the workbook
 */
export function getWorkbookBasePath(workbookId: string): string {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (siteId) {
    return `/sites/${siteId}/drive/items/${workbookId}/workbook`;
  }
  return `/me/drive/items/${workbookId}/workbook`;
}

/**
 * Build the Graph API path for a worksheet
 */
export function getWorksheetPath(
  workbookId: string,
  worksheetName: string
): string {
  return `${getWorkbookBasePath(workbookId)}/worksheets/${worksheetName}`;
}

/**
 * Refresh the access token using the stored refresh_token
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new TokenRefreshError(
      "Missing Microsoft OAuth credentials in environment"
    );
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope:
      "openid profile email User.Read Files.ReadWrite.All Sites.ReadWrite.All Calendars.ReadWrite Tasks.ReadWrite Mail.Send Mail.ReadWrite offline_access",
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new TokenRefreshError(
      `Failed to refresh token: ${response.status} - ${error}`
    );
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Get a Microsoft Graph client for a specific user
 */
export async function getGraphClient(userId: string): Promise<Client> {
  const [account] = await db
    .select({
      refreshToken: accounts.refresh_token,
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "microsoft-entra-id")
      )
    )
    .limit(1);

  if (!account || !account.refreshToken) {
    throw new UserNotConnectedError(userId);
  }

  const tokenResponse = await refreshAccessToken(account.refreshToken);

  // Update stored tokens (Microsoft rotates refresh_tokens)
  await db
    .update(accounts)
    .set({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token ?? account.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
    })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "microsoft-entra-id")
      )
    );

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.access_token);
    },
  });
}

/**
 * Create an Excel session for batch operations
 */
export async function createExcelSession(
  client: Client,
  workbookId: string
): Promise<ExcelSession> {
  const basePath = getWorkbookBasePath(workbookId);
  const response = await client
    .api(`${basePath}/createSession`)
    .post({ persistChanges: true });

  return response as ExcelSession;
}

/**
 * Close an Excel session to save changes
 */
export async function closeExcelSession(
  client: Client,
  workbookId: string,
  sessionId: string
): Promise<void> {
  const basePath = getWorkbookBasePath(workbookId);
  await client
    .api(`${basePath}/closeSession`)
    .header("workbook-session-id", sessionId)
    .post({});
}

/**
 * Chunk an array into groups (default 20 for Graph API batch limit)
 */
export function chunkArray<T>(array: T[], size: number = 20): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
