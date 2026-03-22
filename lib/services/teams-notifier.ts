/**
 * Teams Workflow Notifier — Adaptive Card Delivery
 * ==================================================
 * Sends Adaptive Cards to a Microsoft Teams channel via Power Automate
 * Workflows webhook endpoint.
 *
 * Rate limiting: Teams Workflows enforce ~4 req/sec. We throttle to
 * 250ms minimum between requests to stay well under.
 *
 * Security: The webhook URL is effectively a bearer token — it grants
 * POST access to the channel. NEVER log the URL.
 *
 * Retry: 3 attempts with exponential backoff on 4xx/5xx responses.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Adaptive Card JSON structure (version 1.4, Teams-compatible).
 * This is the card content itself — the wrapper is added by this module.
 */
export interface AdaptiveCard {
  type: "AdaptiveCard";
  version: string;
  body: unknown[];
  actions?: unknown[];
  $schema?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MIN_REQUEST_INTERVAL_MS = 250; // 4 req/sec limit → 250ms between
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Throttle state (module-level)
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

/**
 * Wait until at least MIN_REQUEST_INTERVAL_MS has elapsed since the last request.
 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

/**
 * Exponential backoff: 1s, 2s, 4s
 */
function getBackoffMs(attempt: number): number {
  return Math.pow(2, attempt) * 1000;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send an Adaptive Card to Teams via the Workflows webhook.
 *
 * @param card - The Adaptive Card content
 * @throws Error after MAX_RETRIES failed attempts
 */
async function sendCard(card: AdaptiveCard): Promise<void> {
  const webhookUrl = process.env.TEAMS_WORKFLOW_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error(
      "Missing TEAMS_WORKFLOW_WEBHOOK_URL environment variable. " +
        "Cannot send Teams notifications."
    );
  }

  // Wrap card in the Teams Workflows message envelope
  const payload = JSON.stringify({
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ],
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = getBackoffMs(attempt);
      console.warn(
        `[teams-notifier] Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    await throttle();

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // Log status without revealing the URL
      console.log(
        `[teams-notifier] POST response: ${response.status} ${response.statusText}`
      );

      if (response.ok || response.status === 202) {
        return; // Success
      }

      // Non-retryable client errors (except 429 which we retry)
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        const body = await response.text().catch(() => "(unreadable)");
        const err = new Error(
          `Teams webhook returned ${response.status}: ${body.substring(0, 200)}`
        );
        (err as Error & { _nonRetryable: boolean })._nonRetryable = true;
        throw err;
      }

      // 429 or 5xx — retryable
      lastError = new Error(
        `Teams webhook returned ${response.status} ${response.statusText}`
      );
    } catch (error) {
      // Re-throw non-retryable errors immediately (e.g. 4xx client errors)
      if (error instanceof Error && (error as Error & { _nonRetryable?: boolean })._nonRetryable) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(
          `Teams webhook timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error));
      }
      console.warn(
        `[teams-notifier] Attempt ${attempt + 1} failed:`,
        lastError.message
      );
    }
  }

  // All retries exhausted
  throw new Error(
    `[teams-notifier] Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an urgent notification card to Teams immediately.
 * Used for score 7-10 emails that need immediate attention.
 */
export async function sendUrgentCard(card: AdaptiveCard): Promise<void> {
  return sendCard(card);
}

/**
 * Send a batch digest card to Teams.
 * Used for the 30-minute batch of score 5-6 emails.
 */
export async function sendBatchCard(card: AdaptiveCard): Promise<void> {
  return sendCard(card);
}
