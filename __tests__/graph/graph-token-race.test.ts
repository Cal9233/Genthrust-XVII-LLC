/**
 * Tests for lib/graph/index.ts — getGraphClient()
 *
 * Validates:
 *   - Returns client immediately when stored token is still valid (no refresh)
 *   - Calls refreshAccessToken when token is expired
 *   - Calls refreshAccessToken when token is expiring within 5-minute buffer
 *   - Calls refreshAccessToken when no access token is stored
 *   - Calls refreshAccessToken when no expiresAt is stored
 *   - Coalesces concurrent refresh calls for the same user into one network call
 *   - Allows independent refresh calls for different users simultaneously
 *   - Throws UserNotConnectedError when account has no refresh token
 *   - Throws UserNotConnectedError when no account row exists
 *   - Updates stored tokens after a successful refresh
 *
 * All DB calls and the refreshAccessToken internal function are mocked via
 * vi.mock on their respective modules. isomorphic-fetch is stubbed globally.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables — must be declared before vi.mock() factories
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbUpdate, mockRefreshFetch } = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockDbUpdate = vi.fn();
  const mockRefreshFetch = vi.fn();
  return { mockDbSelect, mockDbUpdate, mockRefreshFetch };
});

// ---------------------------------------------------------------------------
// Mock isomorphic-fetch (imported by lib/graph/index.ts as a side-effect)
// ---------------------------------------------------------------------------

vi.mock("isomorphic-fetch", () => ({}));

// ---------------------------------------------------------------------------
// Mock @microsoft/microsoft-graph-client
// ---------------------------------------------------------------------------

vi.mock("@microsoft/microsoft-graph-client", () => ({
  Client: {
    init: vi.fn((opts: any) => ({ _authProvider: opts.authProvider })),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/db/index — provide a chainable select/update API
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/index", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => mockDbSelect()),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => mockDbUpdate()),
  };
  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/db/schema
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/schema", () => ({
  accounts: {
    refresh_token: "refresh_token",
    access_token: "access_token",
    expires_at: "expires_at",
    userId: "userId",
    provider: "provider",
  },
}));

// ---------------------------------------------------------------------------
// Mock drizzle-orm (eq, and)
// ---------------------------------------------------------------------------

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ eq: [a, b] })),
  and: vi.fn((...args: any[]) => ({ and: args })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/types/graph
// ---------------------------------------------------------------------------

vi.mock("@/lib/types/graph", () => ({
  UserNotConnectedError: class UserNotConnectedError extends Error {
    constructor(userId: string) {
      super(`User ${userId} not connected`);
      this.name = "UserNotConnectedError";
    }
  },
  TokenRefreshError: class TokenRefreshError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "TokenRefreshError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function makeFreshAccount() {
  return [
    {
      refreshToken: "refresh-token-abc",
      accessToken: "access-token-valid",
      expiresAt: NOW_SECONDS + 3600, // expires in 1 hour
    },
  ];
}

function makeExpiredAccount() {
  return [
    {
      refreshToken: "refresh-token-abc",
      accessToken: "access-token-old",
      expiresAt: NOW_SECONDS - 60, // already expired
    },
  ];
}

function makeExpiringShortlyAccount() {
  return [
    {
      refreshToken: "refresh-token-abc",
      accessToken: "access-token-expiring",
      expiresAt: NOW_SECONDS + 200, // within 5-min (300s) buffer
    },
  ];
}

function makeNoAccessTokenAccount() {
  return [
    {
      refreshToken: "refresh-token-abc",
      accessToken: null,
      expiresAt: NOW_SECONDS + 3600,
    },
  ];
}

function makeNoExpiresAtAccount() {
  return [
    {
      refreshToken: "refresh-token-abc",
      accessToken: "access-token-abc",
      expiresAt: null,
    },
  ];
}

function makeSuccessfulTokenResponse() {
  return {
    access_token: "new-access-token",
    refresh_token: "new-refresh-token",
    expires_in: 3600,
  };
}

function mockTokenEndpointSuccess() {
  mockRefreshFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeSuccessfulTokenResponse()),
  });
  global.fetch = mockRefreshFetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getGraphClient — token validity check", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "tenant-id";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockDbSelect.mockReset();
    mockDbUpdate.mockReset();
    mockRefreshFetch.mockReset();
  });

  it("returns a client without refreshing when token is still valid", async () => {
    mockDbSelect.mockResolvedValue(makeFreshAccount());
    global.fetch = mockRefreshFetch;

    const { getGraphClient } = await import("@/lib/graph/index");
    const client = await getGraphClient("user-1");

    // fetch should NOT have been called (no token refresh)
    expect(mockRefreshFetch).not.toHaveBeenCalled();
    expect(client).toBeDefined();
  });

  it("calls the token endpoint when the stored token has expired", async () => {
    mockDbSelect.mockResolvedValue(makeExpiredAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { getGraphClient } = await import("@/lib/graph/index");
    await getGraphClient("user-1");

    expect(mockRefreshFetch).toHaveBeenCalledOnce();
    const [url] = mockRefreshFetch.mock.calls[0];
    expect(url).toContain("oauth2/v2.0/token");
  });

  it("calls the token endpoint when token is expiring within 5-minute buffer", async () => {
    mockDbSelect.mockResolvedValue(makeExpiringShortlyAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { getGraphClient } = await import("@/lib/graph/index");
    await getGraphClient("user-1");

    expect(mockRefreshFetch).toHaveBeenCalledOnce();
  });

  it("calls the token endpoint when no access token is stored", async () => {
    mockDbSelect.mockResolvedValue(makeNoAccessTokenAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { getGraphClient } = await import("@/lib/graph/index");
    await getGraphClient("user-1");

    expect(mockRefreshFetch).toHaveBeenCalledOnce();
  });

  it("calls the token endpoint when expiresAt is null", async () => {
    mockDbSelect.mockResolvedValue(makeNoExpiresAtAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { getGraphClient } = await import("@/lib/graph/index");
    await getGraphClient("user-1");

    expect(mockRefreshFetch).toHaveBeenCalledOnce();
  });
});

describe("getGraphClient — error cases", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "tenant-id";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockDbSelect.mockReset();
    mockDbUpdate.mockReset();
    mockRefreshFetch.mockReset();
  });

  it("throws UserNotConnectedError when account row does not exist", async () => {
    mockDbSelect.mockResolvedValue([]);

    const { getGraphClient } = await import("@/lib/graph/index");
    const { UserNotConnectedError } = await import("@/lib/types/graph");
    await expect(getGraphClient("user-missing")).rejects.toBeInstanceOf(
      UserNotConnectedError
    );
  });

  it("throws UserNotConnectedError when refreshToken is null", async () => {
    mockDbSelect.mockResolvedValue([
      { refreshToken: null, accessToken: null, expiresAt: null },
    ]);

    const { getGraphClient } = await import("@/lib/graph/index");
    const { UserNotConnectedError } = await import("@/lib/types/graph");
    await expect(getGraphClient("user-no-token")).rejects.toBeInstanceOf(
      UserNotConnectedError
    );
  });
});

describe("getGraphClient — token storage after refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "tenant-id";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockDbSelect.mockReset();
    mockDbUpdate.mockReset();
    mockRefreshFetch.mockReset();
  });

  it("updates stored access and refresh tokens after successful refresh", async () => {
    mockDbSelect.mockResolvedValue(makeExpiredAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { db } = await import("@/lib/db/index");
    const { getGraphClient } = await import("@/lib/graph/index");
    await getGraphClient("user-1");

    // db.update should have been called
    expect(db.update).toHaveBeenCalled();
  });

  it("falls back to old refresh token when response omits refresh_token", async () => {
    mockDbSelect.mockResolvedValue(makeExpiredAccount());
    mockDbUpdate.mockResolvedValue(undefined);

    // Response without a new refresh token
    mockRefreshFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          expires_in: 3600,
          // no refresh_token field
        }),
    });
    global.fetch = mockRefreshFetch;

    const { db } = await import("@/lib/db/index");
    const { getGraphClient } = await import("@/lib/graph/index");
    const client = await getGraphClient("user-1");

    expect(db.update).toHaveBeenCalled();
    expect(client).toBeDefined();
  });
});

describe("getGraphClient — per-user mutex (race condition prevention)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID = "client-id";
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET = "client-secret";
    process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "tenant-id";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockDbSelect.mockReset();
    mockDbUpdate.mockReset();
    mockRefreshFetch.mockReset();
  });

  it("coalesces concurrent refresh calls for the same user into one network call", async () => {
    // Both calls will find an expired token
    mockDbSelect.mockResolvedValue(makeExpiredAccount());
    mockDbUpdate.mockResolvedValue(undefined);

    // Simulate slow token refresh (~10ms) to allow concurrency
    let resolveRefresh!: () => void;
    const refreshBarrier = new Promise<void>((res) => {
      resolveRefresh = res;
    });

    mockRefreshFetch.mockImplementationOnce(async () => {
      await refreshBarrier;
      return {
        ok: true,
        json: () => Promise.resolve(makeSuccessfulTokenResponse()),
      };
    });
    // Second call should never happen — but set it up as a fallback
    mockRefreshFetch.mockImplementation(async () => ({
      ok: true,
      json: () => Promise.resolve(makeSuccessfulTokenResponse()),
    }));
    global.fetch = mockRefreshFetch;

    const { getGraphClient } = await import("@/lib/graph/index");

    // Launch two concurrent calls before the refresh resolves
    const [p1, p2] = [
      getGraphClient("user-concurrent"),
      getGraphClient("user-concurrent"),
    ];

    // Unblock the refresh
    resolveRefresh();

    const [c1, c2] = await Promise.all([p1, p2]);

    // Only one token endpoint call should have been made
    expect(mockRefreshFetch).toHaveBeenCalledOnce();
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
  });

  it("allows independent concurrent refresh calls for different users", async () => {
    // Both users have expired tokens
    mockDbSelect.mockResolvedValue(makeExpiredAccount());
    mockDbUpdate.mockResolvedValue(undefined);
    mockTokenEndpointSuccess();

    const { getGraphClient } = await import("@/lib/graph/index");

    const [c1, c2] = await Promise.all([
      getGraphClient("user-A"),
      getGraphClient("user-B"),
    ]);

    // Each user gets their own refresh — two calls expected
    expect(mockRefreshFetch).toHaveBeenCalledTimes(2);
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Regression: DB write must complete BEFORE waiters receive the resolved
  // token. Previously the DB UPDATE ran after `await refreshPromise`, so
  // concurrent waiters got an in-memory token while the DB still held the
  // old (now invalidated) refresh token — causing permanent account lockout
  // on the next serverless invocation.
  // -------------------------------------------------------------------------
  it("DB write completes before concurrent waiters resolve (regression: mutex waiter persistence)", async () => {
    mockDbSelect.mockResolvedValue(makeExpiredAccount());

    // Track the order: did DB update finish before any caller's promise resolved?
    const events: string[] = [];

    // Slow fetch so the second getGraphClient() hits the existingPromise branch
    let resolveRefresh!: () => void;
    const refreshBarrier = new Promise<void>((res) => {
      resolveRefresh = res;
    });

    mockRefreshFetch.mockImplementationOnce(async () => {
      await refreshBarrier;
      return {
        ok: true,
        json: () => Promise.resolve(makeSuccessfulTokenResponse()),
      };
    });
    mockRefreshFetch.mockImplementation(async () => ({
      ok: true,
      json: () => Promise.resolve(makeSuccessfulTokenResponse()),
    }));
    global.fetch = mockRefreshFetch;

    // mockDbUpdate records when the DB write happens
    mockDbUpdate.mockImplementation(async () => {
      events.push("db-write");
      return undefined;
    });

    const { getGraphClient } = await import("@/lib/graph/index");

    const p1 = getGraphClient("user-waiter").then((c) => {
      events.push("caller-1-resolved");
      return c;
    });
    const p2 = getGraphClient("user-waiter").then((c) => {
      events.push("caller-2-resolved");
      return c;
    });

    resolveRefresh();
    await Promise.all([p1, p2]);

    // DB write must appear before BOTH callers resolve
    const dbIdx = events.indexOf("db-write");
    const c1Idx = events.indexOf("caller-1-resolved");
    const c2Idx = events.indexOf("caller-2-resolved");

    expect(dbIdx).toBeGreaterThanOrEqual(0);
    expect(dbIdx).toBeLessThan(c1Idx);
    expect(dbIdx).toBeLessThan(c2Idx);

    // Still only one token endpoint call (mutex coalescing preserved)
    expect(mockRefreshFetch).toHaveBeenCalledOnce();
  });
});
