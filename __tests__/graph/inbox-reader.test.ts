/**
 * Tests for inbox-reader.ts (fetchNewEmails)
 *
 * Validates:
 *   - Normal delta response: returns emails + newDeltaLink
 *   - Pagination: follows @odata.nextLink, accumulates all pages
 *   - 410 Gone (expired delta token): returns empty + null deltaLink
 *   - 404: throws MailboxNotFoundError
 *   - 403: throws MailboxDisabledError
 *   - Empty mailbox (no emails): returns empty array with deltaLink
 *   - Subsequent poll with existing deltaLink (uses delta URL directly)
 *   - Missing @odata.nextLink and @odata.deltaLink: stops gracefully
 *
 * getAppGraphClient is mocked — no real MSAL or Graph API calls made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock daemon-client before importing inbox-reader
// ---------------------------------------------------------------------------

vi.mock("@/lib/graph/daemon-client", () => ({
  getAppGraphClient: vi.fn(),
}));

import { getAppGraphClient } from "@/lib/graph/daemon-client";
import {
  fetchNewEmails,
  MailboxNotFoundError,
  MailboxDisabledError,
  type GraphEmail,
} from "@/lib/graph/inbox-reader";

const mockGetAppGraphClient = vi.mocked(getAppGraphClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraphEmail(overrides: Partial<GraphEmail> = {}): GraphEmail {
  return {
    id: "email-graph-id-1",
    subject: "Test Email",
    from: {
      emailAddress: {
        name: "Vendor",
        address: "vendor@heliparts.com",
      },
    },
    bodyPreview: "Email body preview text",
    body: { content: "<p>Email body</p>", contentType: "html" },
    importance: "normal",
    receivedDateTime: "2026-03-17T14:30:00Z",
    webLink: "https://outlook.office.com/mail/test",
    hasAttachments: false,
    conversationId: "conv-id-1",
    ...overrides,
  };
}

/**
 * Create a mock Graph client where each .api().get() call returns the next
 * response in the sequence. .header() returns the chain for chaining.
 */
function createMockClient(responses: Array<Record<string, unknown> | Error>) {
  let callIndex = 0;

  const mockGet = vi.fn().mockImplementation(async () => {
    const response = responses[callIndex++];
    if (response instanceof Error) throw response;
    return response;
  });

  const mockChain = {
    get: mockGet,
    header: vi.fn().mockReturnThis(),
  };

  return {
    client: { api: vi.fn().mockReturnValue(mockChain) },
    mockGet,
    mockApi: mockChain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Normal delta response (initial sync)
// ---------------------------------------------------------------------------

describe("fetchNewEmails — normal delta response", () => {
  it("returns emails and deltaLink on initial sync (no prior deltaLink)", async () => {
    const email = makeGraphEmail();
    const { client } = createMockClient([
      {
        value: [email],
        "@odata.deltaLink":
          "https://graph.microsoft.com/v1.0/users/test/mailFolders/Inbox/messages/delta?$deltatoken=abc123",
      },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].id).toBe("email-graph-id-1");
    expect(result.newDeltaLink).toContain("deltatoken");
  });

  it("adds Prefer header on initial sync (deltaLink=null)", async () => {
    const { client, mockApi } = createMockClient([
      { value: [], "@odata.deltaLink": "https://delta.link/token" },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await fetchNewEmails("user@genthrust.net", null);

    // The .header() method should have been called (Prefer: odata.maxpagesize=50)
    expect(mockApi.header).toHaveBeenCalledWith(
      "Prefer",
      expect.stringContaining("odata.maxpagesize")
    );
  });

  it("does NOT add Prefer header on subsequent poll (deltaLink provided)", async () => {
    const existingDeltaLink =
      "https://graph.microsoft.com/v1.0/users/test/mailFolders/Inbox/messages/delta?$deltatoken=existing";

    const { client, mockApi } = createMockClient([
      {
        value: [makeGraphEmail()],
        "@odata.deltaLink": "https://delta.link/new-token",
      },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await fetchNewEmails("user@genthrust.net", existingDeltaLink);

    // For subsequent polls, no Prefer header should be added
    expect(mockApi.header).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pagination: follows @odata.nextLink
// ---------------------------------------------------------------------------

describe("fetchNewEmails — pagination", () => {
  it("follows @odata.nextLink and accumulates emails from all pages", async () => {
    const email1 = makeGraphEmail({ id: "email-1", subject: "First Email" });
    const email2 = makeGraphEmail({ id: "email-2", subject: "Second Email" });
    const email3 = makeGraphEmail({ id: "email-3", subject: "Third Email" });

    const { client } = createMockClient([
      // Page 1: has nextLink
      {
        value: [email1, email2],
        "@odata.nextLink": "https://graph.microsoft.com/nextpage?skip=2",
      },
      // Page 2: has deltaLink (final page)
      {
        value: [email3],
        "@odata.deltaLink": "https://delta.link/final-token",
      },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    expect(result.emails).toHaveLength(3);
    expect(result.emails[0].id).toBe("email-1");
    expect(result.emails[1].id).toBe("email-2");
    expect(result.emails[2].id).toBe("email-3");
    expect(result.newDeltaLink).toBe("https://delta.link/final-token");
  });

  it("follows multiple nextLink pages", async () => {
    const emails = Array.from({ length: 5 }, (_, i) =>
      makeGraphEmail({ id: `email-${i}`, subject: `Email ${i}` })
    );

    const { client } = createMockClient([
      { value: [emails[0], emails[1]], "@odata.nextLink": "https://next/page2" },
      { value: [emails[2], emails[3]], "@odata.nextLink": "https://next/page3" },
      { value: [emails[4]], "@odata.deltaLink": "https://delta/token" },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    expect(result.emails).toHaveLength(5);
    expect(result.newDeltaLink).toBe("https://delta/token");
  });
});

// ---------------------------------------------------------------------------
// 410 Gone — expired delta token
// ---------------------------------------------------------------------------

describe("fetchNewEmails — 410 Gone (delta token expired)", () => {
  it("returns empty emails and null deltaLink on 410", async () => {
    const error410 = Object.assign(new Error("Gone"), { statusCode: 410 });
    const { client } = createMockClient([error410]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", "stale-delta-link");

    expect(result.emails).toHaveLength(0);
    expect(result.newDeltaLink).toBeNull();
  });

  it("also handles 410 via error.code string property", async () => {
    const error410 = Object.assign(new Error("Gone"), { code: "410" });
    const { client } = createMockClient([error410]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    expect(result.emails).toHaveLength(0);
    expect(result.newDeltaLink).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 404 Not Found — mailbox deleted
// ---------------------------------------------------------------------------

describe("fetchNewEmails — 404 (mailbox not found)", () => {
  it("throws MailboxNotFoundError on 404", async () => {
    const error404 = Object.assign(new Error("Not Found"), { statusCode: 404 });
    const { client } = createMockClient([error404]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(fetchNewEmails("deleted@genthrust.net", null)).rejects.toThrow(
      MailboxNotFoundError
    );
  });

  it("MailboxNotFoundError message contains the mailbox ID", async () => {
    const error404 = Object.assign(new Error("Not Found"), { statusCode: 404 });
    const { client } = createMockClient([error404]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(
      fetchNewEmails("deleted@genthrust.net", null)
    ).rejects.toThrow("deleted@genthrust.net");
  });
});

// ---------------------------------------------------------------------------
// 403 Forbidden — mailbox access revoked
// ---------------------------------------------------------------------------

describe("fetchNewEmails — 403 (mailbox disabled/forbidden)", () => {
  it("throws MailboxDisabledError on 403", async () => {
    const error403 = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    const { client } = createMockClient([error403]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(fetchNewEmails("ops@genthrust.net", null)).rejects.toThrow(
      MailboxDisabledError
    );
  });

  it("MailboxDisabledError message contains the mailbox ID", async () => {
    const error403 = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    const { client } = createMockClient([error403]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(
      fetchNewEmails("ops@genthrust.net", null)
    ).rejects.toThrow("ops@genthrust.net");
  });
});

// ---------------------------------------------------------------------------
// Empty mailbox
// ---------------------------------------------------------------------------

describe("fetchNewEmails — empty mailbox", () => {
  it("returns empty emails array with deltaLink when mailbox has no messages", async () => {
    const { client } = createMockClient([
      {
        value: [],
        "@odata.deltaLink": "https://delta.link/empty-token",
      },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    expect(result.emails).toHaveLength(0);
    expect(result.newDeltaLink).toBe("https://delta.link/empty-token");
  });
});

// ---------------------------------------------------------------------------
// Unknown errors are re-thrown
// ---------------------------------------------------------------------------

describe("fetchNewEmails — unexpected errors are re-thrown", () => {
  it("re-throws errors that are not 404, 403, or 410", async () => {
    const error500 = Object.assign(new Error("Internal Server Error"), {
      statusCode: 500,
    });
    const { client } = createMockClient([error500]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(fetchNewEmails("user@genthrust.net", null)).rejects.toThrow(
      "Internal Server Error"
    );
  });

  it("re-throws generic network errors", async () => {
    const networkError = new Error("Network connection refused");
    const { client } = createMockClient([networkError]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    await expect(fetchNewEmails("user@genthrust.net", null)).rejects.toThrow(
      "Network connection refused"
    );
  });
});

// ---------------------------------------------------------------------------
// Response without nextLink or deltaLink (graceful handling)
// ---------------------------------------------------------------------------

describe("fetchNewEmails — missing odata links in response", () => {
  it("stops gracefully when response has neither nextLink nor deltaLink", async () => {
    const email = makeGraphEmail();
    const { client } = createMockClient([
      {
        value: [email],
        // No @odata.nextLink or @odata.deltaLink
      },
    ]);
    mockGetAppGraphClient.mockResolvedValue(client as any);

    const result = await fetchNewEmails("user@genthrust.net", null);

    // Should return emails collected so far, with null deltaLink
    expect(result.emails).toHaveLength(1);
    expect(result.newDeltaLink).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

describe("MailboxNotFoundError and MailboxDisabledError", () => {
  it("MailboxNotFoundError has correct name", () => {
    const err = new MailboxNotFoundError("test@example.com");
    expect(err.name).toBe("MailboxNotFoundError");
    expect(err).toBeInstanceOf(Error);
  });

  it("MailboxDisabledError has correct name", () => {
    const err = new MailboxDisabledError("test@example.com");
    expect(err.name).toBe("MailboxDisabledError");
    expect(err).toBeInstanceOf(Error);
  });
});
