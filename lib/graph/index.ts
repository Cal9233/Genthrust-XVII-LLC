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

// ---------------------------------------------------------------------------
// Per-user refresh mutex: prevents concurrent callers from consuming the same
// rotating Microsoft refresh token. Pattern mirrors erp-client.ts.
// ---------------------------------------------------------------------------
const graphRefreshPromises = new Map<string, Promise<TokenResponse>>();

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
 * Get a Microsoft Graph client for a specific user.
 *
 * Race-condition fix: Microsoft Entra rotates refresh tokens on each use.
 * Under concurrent load, multiple callers would each try to refresh the same
 * refresh token simultaneously, causing all but one to receive an invalidated
 * token. This implementation:
 *   1. Skips refresh entirely when the stored access token is still valid
 *      (with a 5-minute buffer).
 *   2. Coalesces concurrent refresh requests for the same user into a single
 *      network call using a per-user Promise mutex (same pattern as erp-client.ts).
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

  // If the stored token is still valid with 5-minute buffer, reuse it
  const now = Math.floor(Date.now() / 1000);
  if (account.accessToken && account.expiresAt && account.expiresAt > now + 300) {
    return Client.init({
      authProvider: (done) => {
        done(null, account.accessToken!);
      },
    });
  }

  // Token expired or expiring soon — refresh, coalescing concurrent callers
  const existingPromise = graphRefreshPromises.get(userId);
  if (existingPromise) {
    // Another caller is already refreshing for this user — wait for their result
    const tokenResponse = await existingPromise;
    return Client.init({
      authProvider: (done) => {
        done(null, tokenResponse.access_token);
      },
    });
  }

  // We are the first caller — own the refresh for this user.
  //
  // IMPORTANT: the DB write is part of the promise chain, NOT after it.
  // This ensures that concurrent waiters (the `await existingPromise` branch
  // above) only receive the resolved TokenResponse after the new tokens have
  // already been persisted to the database. If the DB write were placed after
  // `await refreshPromise`, waiters would resolve with an in-memory token that
  // is not yet in the DB — causing the next serverless invocation to find the
  // old (invalidated) refresh token and permanently lock out the account.
  const storedRefreshToken = account.refreshToken;
  const refreshPromise = refreshAccessToken(storedRefreshToken)
    .then(async (tokenResponse) => {
      // Persist new tokens BEFORE resolving to waiters
      await db
        .update(accounts)
        .set({
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token ?? storedRefreshToken,
          expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
        })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, "microsoft-entra-id")
          )
        );
      return tokenResponse;
    })
    .finally(() => {
      graphRefreshPromises.delete(userId);
    });
  graphRefreshPromises.set(userId, refreshPromise);

  const tokenResponse = await refreshPromise;

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
