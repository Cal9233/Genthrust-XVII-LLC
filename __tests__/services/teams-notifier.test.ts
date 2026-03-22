/**
 * Tests for teams-notifier.ts
 *
 * Validates:
 *   - Successful card send (200/202 response)
 *   - Missing TEAMS_WORKFLOW_WEBHOOK_URL throws immediately
 *   - Teams message envelope structure (type, attachments, contentType)
 *   - Webhook URL is NEVER logged to console
 *   - Non-retryable 4xx (e.g. 400, 404) throws immediately without retry
 *   - Retry on 429 (rate limited) — succeeds on second attempt
 *   - Retry on 500 — exhausts all 3 attempts and throws
 *   - Network errors retry and throw after exhaustion
 *
 * Uses vi.stubGlobal to mock fetch.
 * Uses vi.useFakeTimers for retry backoff tests to avoid real delays.
 *
 * TEST ORDER NOTE: Non-retryable tests (400/404) MUST run before fake-timer
 * retry tests. teams-notifier.ts has a module-level `lastRequestTime` for
 * throttling. Fake-timer tests advance Date.now() into the future; if
 * real-timer tests run after, throttle() computes a huge real delay and
 * times out. Ordering non-retryable tests first avoids this contamination.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendUrgentCard,
  sendBatchCard,
  type AdaptiveCard,
} from "@/lib/services/teams-notifier";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_URL = "https://webhook.office.com/webhookb2/test-channel-id/IncomingWebhook/test";

function makeCard(): AdaptiveCard {
  return {
    type: "AdaptiveCard",
    version: "1.4",
    body: [{ type: "TextBlock", text: "Test notification" }],
    actions: [],
  };
}

function mockFetchStatus(status: number, ok = false) {
  return {
    ok,
    status,
    statusText: `Status ${status}`,
    text: async () => `Response body for ${status}`,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  process.env.TEAMS_WORKFLOW_WEBHOOK_URL = WEBHOOK_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.TEAMS_WORKFLOW_WEBHOOK_URL;
});

// ---------------------------------------------------------------------------
// Successful send
// ---------------------------------------------------------------------------

describe("sendUrgentCard — successful send", () => {
  it("resolves without error on 200 response", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    await expect(sendUrgentCard(makeCard())).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("resolves without error on 202 Accepted response", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(202, true));

    await expect(sendUrgentCard(makeCard())).resolves.toBeUndefined();
  });

  it("calls fetch with POST method and application/json content-type", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    await sendUrgentCard(makeCard());

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(WEBHOOK_URL);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

describe("sendBatchCard — successful send", () => {
  it("resolves without error on 200 response", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    await expect(sendBatchCard(makeCard())).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Missing env var
// ---------------------------------------------------------------------------

describe("sendUrgentCard — missing webhook URL", () => {
  it("throws immediately when TEAMS_WORKFLOW_WEBHOOK_URL is not set", async () => {
    delete process.env.TEAMS_WORKFLOW_WEBHOOK_URL;

    await expect(sendUrgentCard(makeCard())).rejects.toThrow(
      "TEAMS_WORKFLOW_WEBHOOK_URL"
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Teams message envelope structure
// ---------------------------------------------------------------------------

describe("sendUrgentCard — message envelope format", () => {
  it("wraps card in Teams Workflow message envelope", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    const card = makeCard();
    await sendUrgentCard(card);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.type).toBe("message");
    expect(Array.isArray(body.attachments)).toBe(true);
    expect(body.attachments).toHaveLength(1);
  });

  it("uses correct Adaptive Card content type in attachment", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    await sendUrgentCard(makeCard());

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.attachments[0].contentType).toBe(
      "application/vnd.microsoft.card.adaptive"
    );
  });

  it("includes the Adaptive Card as attachment content", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    const card = makeCard();
    await sendUrgentCard(card);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.attachments[0].content.type).toBe("AdaptiveCard");
    expect(body.attachments[0].content.version).toBe("1.4");
  });

  it("sends valid JSON body (JSON.parse succeeds)", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    await sendUrgentCard(makeCard());

    const [, options] = mockFetch.mock.calls[0];
    expect(() => JSON.parse(options.body)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Webhook URL security — never logged
// ---------------------------------------------------------------------------

describe("sendUrgentCard — webhook URL security", () => {
  it("does NOT log the webhook URL to console.log", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendUrgentCard(makeCard());

    for (const call of consoleSpy.mock.calls) {
      const loggedContent = call.join(" ");
      expect(loggedContent).not.toContain(WEBHOOK_URL);
      expect(loggedContent).not.toContain("webhook.office.com");
    }

    consoleSpy.mockRestore();
  });

  it("logs response status but not the URL", async () => {
    mockFetch.mockResolvedValue(mockFetchStatus(200, true));

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendUrgentCard(makeCard());

    // Should have logged the response status
    const allLogs = consoleSpy.mock.calls.flat().join(" ");
    expect(allLogs).toContain("200");
    expect(allLogs).not.toContain("webhook.office.com");

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Non-retryable 4xx (immediately throws, no retry)
// NOTE: These MUST run before fake-timer retry tests to avoid module-level
// lastRequestTime contamination from advanced fake timestamps.
// ---------------------------------------------------------------------------

describe("sendUrgentCard — non-retryable client errors", () => {
  it("throws immediately on 400 without retrying", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => "Bad request body",
    });

    await expect(sendUrgentCard(makeCard())).rejects.toThrow("400");
    // Only 1 attempt — non-retryable
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on 404 without retrying", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Webhook not found",
    });

    await expect(sendUrgentCard(makeCard())).rejects.toThrow("404");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retry on 429 (rate limited)
// ---------------------------------------------------------------------------

describe("sendUrgentCard — retry on 429", () => {
  it("retries on 429 and succeeds on second attempt", async () => {
    vi.useFakeTimers();

    mockFetch
      .mockResolvedValueOnce(mockFetchStatus(429, false)) // first: rate limited
      .mockResolvedValue(mockFetchStatus(200, true)); // second: success

    const sendPromise = sendUrgentCard(makeCard());
    await vi.advanceTimersByTimeAsync(30_000); // skip backoff delays
    await sendPromise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Retry on 500 (server error)
// ---------------------------------------------------------------------------

describe("sendUrgentCard — retry on 500 until exhausted", () => {
  it("retries 3 times on 500 then throws", async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValue(mockFetchStatus(500, false));

    const sendPromise = sendUrgentCard(makeCard());
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const expectRejection = expect(sendPromise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000); // skip all backoff delays
    await expectRejection;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Network error (fetch throws)
// ---------------------------------------------------------------------------

describe("sendUrgentCard — network/fetch errors", () => {
  it("retries on network error and throws after exhaustion", async () => {
    vi.useFakeTimers();

    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    const sendPromise = sendUrgentCard(makeCard());
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const expectRejection = expect(sendPromise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(60_000);
    await expectRejection;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
