/**
 * Inbox Reader — Delta Query for Mailbox Monitoring
 * ===================================================
 * Uses Microsoft Graph delta queries to efficiently fetch only NEW emails
 * since the last poll. Supports multiple mailboxes with per-mailbox error
 * isolation.
 *
 * Delta query flow:
 *   1. First call (deltaLink=null): GET .../messages/delta → pages through ALL inbox
 *   2. Subsequent calls: GET {deltaLink} → returns only changes since last call
 *   3. 410 Gone: delta token expired → re-initialize (return empty + null deltaLink)
 *
 * CRITICAL: Must follow @odata.nextLink pagination — emails on page 2+
 * are silently lost without it.
 */

import { getAppGraphClient } from "./daemon-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphEmailAddress {
  name: string;
  address: string;
}

export interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: GraphEmailAddress;
  };
  bodyPreview: string;
  importance: "low" | "normal" | "high";
  receivedDateTime: string;
  webLink: string;
  hasAttachments: boolean;
  conversationId: string;
  /** RFC 2822 Message-ID — identical across mailboxes for the same email.
   *  Used for cross-mailbox content deduplication. */
  internetMessageId: string;
}

export interface FetchEmailsResult {
  emails: GraphEmail[];
  newDeltaLink: string | null;
}

// ---------------------------------------------------------------------------
// Custom errors for per-mailbox error isolation
// ---------------------------------------------------------------------------

export class MailboxNotFoundError extends Error {
  constructor(mailboxId: string) {
    super(`Mailbox not found (404): ${mailboxId}. It may have been deleted.`);
    this.name = "MailboxNotFoundError";
  }
}

export class MailboxDisabledError extends Error {
  constructor(mailboxId: string) {
    super(
      `Mailbox access forbidden (403): ${mailboxId}. ` +
        `Check RBAC scoping or mailbox status.`
    );
    this.name = "MailboxDisabledError";
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SELECT_FIELDS = [
  "subject",
  "from",
  "bodyPreview",
  "importance",
  "receivedDateTime",
  "webLink",
  "hasAttachments",
  "conversationId",
  "internetMessageId",
].join(",");

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Fetch new emails from a mailbox using Graph delta queries.
 *
 * @param mailboxId - The UPN or mailbox GUID (e.g., "cmalagon@genthrust.net")
 * @param deltaLink - Previous delta link, or null for initial sync
 * @returns Object with new emails and the updated delta link
 *
 * @throws {MailboxNotFoundError} if the mailbox doesn't exist (404)
 * @throws {MailboxDisabledError} if access is denied (403)
 *
 * On 410 Gone (expired delta token): returns { emails: [], newDeltaLink: null }
 * so the caller can re-initialize on the next poll cycle.
 */
export async function fetchNewEmails(
  mailboxId: string,
  deltaLink: string | null
): Promise<FetchEmailsResult> {
  const client = await getAppGraphClient();

  // Determine the starting URL
  const initialUrl = `/users/${encodeURIComponent(
    mailboxId
  )}/mailFolders/Inbox/messages/delta?$select=${SELECT_FIELDS}&$top=${PAGE_SIZE}`;

  let nextUrl: string | null = deltaLink || initialUrl;
  const allEmails: GraphEmail[] = [];
  let latestDeltaLink: string | null = null;

  // Pagination loop — MUST follow @odata.nextLink until exhausted
  while (nextUrl) {
    let response: Record<string, unknown>;

    try {
      // For delta links (full URLs), use .api() directly — the Graph SDK
      // handles absolute URLs. For initial requests, use the relative path.
      const request = client.api(nextUrl);

      // On initial sync (no deltaLink), add Prefer header for minimal response
      if (!deltaLink && nextUrl === initialUrl) {
        request.header("Prefer", "odata.maxpagesize=50");
      }

      response = await request.get();
    } catch (error: unknown) {
      const statusCode = getErrorStatusCode(error);

      if (statusCode === 410) {
        // Delta token expired — caller should re-initialize
        console.warn(
          `[inbox-reader] Delta token expired for ${mailboxId}. Will re-initialize on next poll.`
        );
        return { emails: [], newDeltaLink: null };
      }

      if (statusCode === 404) {
        throw new MailboxNotFoundError(mailboxId);
      }

      if (statusCode === 403) {
        throw new MailboxDisabledError(mailboxId);
      }

      // Re-throw unexpected errors
      throw error;
    }

    // Collect emails from this page
    const pageEmails = (response.value as GraphEmail[]) || [];
    allEmails.push(...pageEmails);

    // Check for next page or final delta link
    const odataNextLink = response["@odata.nextLink"] as string | undefined;
    const odataDeltaLink = response["@odata.deltaLink"] as string | undefined;

    if (odataNextLink) {
      // More pages to fetch
      nextUrl = odataNextLink;
    } else if (odataDeltaLink) {
      // Final page reached — save delta link for next poll
      latestDeltaLink = odataDeltaLink;
      nextUrl = null;
    } else {
      // No more data and no delta link (shouldn't happen, but handle gracefully)
      console.warn(
        `[inbox-reader] No @odata.nextLink or @odata.deltaLink in response for ${mailboxId}`
      );
      nextUrl = null;
    }
  }

  return {
    emails: allEmails,
    newDeltaLink: latestDeltaLink,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract HTTP status code from Graph SDK errors.
 * The Graph SDK wraps errors in a GraphError object with a statusCode property.
 */
function getErrorStatusCode(error: unknown): number | null {
  if (error && typeof error === "object") {
    // @microsoft/microsoft-graph-client wraps errors as { statusCode: number }
    if ("statusCode" in error && typeof (error as Record<string, unknown>).statusCode === "number") {
      return (error as Record<string, unknown>).statusCode as number;
    }
    // Some errors nest under .code as a string like "404"
    if ("code" in error && typeof (error as Record<string, unknown>).code === "string") {
      const code = parseInt((error as Record<string, unknown>).code as string, 10);
      if (!isNaN(code)) return code;
    }
  }
  return null;
}
