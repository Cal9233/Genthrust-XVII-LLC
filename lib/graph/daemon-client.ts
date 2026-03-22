/**
 * MSAL Daemon Client for Application-Level Graph API Access
 * ==========================================================
 * Uses certificate-based auth (ConfidentialClientApplication) to access
 * Graph API on behalf of the application (not a user). This enables
 * reading any @genthrust.net mailbox via Application Mail.Read permission
 * scoped by Exchange RBAC.
 *
 * CRITICAL: The MSAL app is a MODULE-LEVEL SINGLETON. MSAL handles
 * token caching internally — do NOT create a new instance per request.
 *
 * Required env vars:
 *   MONITOR_APP_CLIENT_ID    — Azure app registration client ID
 *   MONITOR_APP_TENANT_ID    — Azure tenant ID
 *   MONITOR_APP_CERT_THUMBPRINT — SHA-256 thumbprint of the uploaded certificate
 *   MONITOR_APP_CERT_PEM     — Base64-encoded PEM private key
 */

import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

// ---------------------------------------------------------------------------
// Configuration validation (fail fast at module load)
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Daemon Graph client cannot initialize without it.`
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// PEM decoding (once at module load)
// ---------------------------------------------------------------------------

function decodePem(): string {
  const base64 = getRequiredEnv("MONITOR_APP_CERT_PEM");
  const decoded = Buffer.from(base64, "base64").toString("utf-8");

  if (
    !decoded.includes("-----BEGIN") ||
    !decoded.includes("PRIVATE KEY")
  ) {
    throw new Error(
      "MONITOR_APP_CERT_PEM does not contain a valid PEM private key after base64 decoding."
    );
  }

  return decoded;
}

// ---------------------------------------------------------------------------
// MSAL Singleton (module-level — created once, reused across all requests)
// ---------------------------------------------------------------------------

let msalInstance: ConfidentialClientApplication | null = null;
let msalInitPromise: Promise<ConfidentialClientApplication> | null = null;

function getMsalConfig(): Configuration {
  const clientId = getRequiredEnv("MONITOR_APP_CLIENT_ID");
  const tenantId = getRequiredEnv("MONITOR_APP_TENANT_ID");
  const thumbprint = getRequiredEnv("MONITOR_APP_CERT_THUMBPRINT");
  const privateKey = decodePem();

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientCertificate: {
        thumbprintSha256: thumbprint,
        privateKey,
      },
    },
  };
}

/**
 * Get or create the MSAL singleton.
 * Uses a shared init promise to prevent thundering herd on concurrent callers.
 */
async function getMsalApp(): Promise<ConfidentialClientApplication> {
  if (msalInstance) return msalInstance;

  if (msalInitPromise) return msalInitPromise;

  msalInitPromise = (async () => {
    try {
      const config = getMsalConfig();
      const app = new ConfidentialClientApplication(config);
      msalInstance = app;
      return app;
    } finally {
      msalInitPromise = null;
    }
  })();

  return msalInitPromise;
}

// ---------------------------------------------------------------------------
// Token acquisition
// ---------------------------------------------------------------------------

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/**
 * Acquire an application-level access token.
 * MSAL handles caching internally — this will return a cached token
 * if one is still valid, or silently refresh if needed.
 */
async function acquireToken(): Promise<string> {
  const app = await getMsalApp();

  const result = await app.acquireTokenByClientCredential({
    scopes: [GRAPH_SCOPE],
  });

  if (!result || !result.accessToken) {
    throw new Error(
      "MSAL acquireTokenByClientCredential returned no access token. " +
        "Check certificate thumbprint and app permissions."
    );
  }

  return result.accessToken;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a Microsoft Graph client authenticated as the daemon application.
 *
 * Each call returns a fresh Client instance, but the underlying MSAL app
 * and token cache are singletons — so token acquisition is efficient.
 *
 * Usage:
 *   const client = await getAppGraphClient();
 *   const messages = await client.api('/users/cmalagon@genthrust.net/mailFolders/Inbox/messages').get();
 */
export async function getAppGraphClient(): Promise<Client> {
  const accessToken = await acquireToken();

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
