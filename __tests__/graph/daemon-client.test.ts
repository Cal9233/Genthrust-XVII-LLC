/**
 * Tests for daemon-client.ts (getAppGraphClient)
 *
 * Validates:
 *   - Returns a Graph client when env vars are valid
 *   - Base64-encoded PEM is decoded and passed to MSAL correctly
 *   - Correct Graph scope ("https://graph.microsoft.com/.default") is used
 *   - MSAL singleton reused: ConfidentialClientApplication only constructed once
 *   - Throws when required env vars are missing
 *   - Throws when PEM does not decode to a valid private key
 *   - Throws when MSAL returns no access token
 *
 * Uses vi.resetModules() before each test to clear the MSAL singleton state.
 * @azure/msal-node, @microsoft/microsoft-graph-client, and isomorphic-fetch
 * are all mocked — no real network or certificate operations performed.
 *
 * IMPORTANT: vi.hoisted() is used to declare mock variables BEFORE vi.mock()
 * factories run (vi.mock calls are hoisted above const declarations).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// PEM fixture
// ---------------------------------------------------------------------------

const VALID_PEM_CONTENT =
  "-----BEGIN PRIVATE KEY-----\nMOCKPRIVATEKEYDATA123456\n-----END PRIVATE KEY-----";
const VALID_PEM_BASE64 = Buffer.from(VALID_PEM_CONTENT).toString("base64");

// ---------------------------------------------------------------------------
// Hoisted mock variables — MUST be declared before vi.mock() factories run.
// vi.hoisted() ensures these are initialized BEFORE the mock factories execute,
// even though vi.mock() calls appear later in source order.
// ---------------------------------------------------------------------------

const { mockAcquireToken, MockConfidentialClientApplication, mockClientInit } =
  vi.hoisted(() => {
    const mockAcquireToken = vi.fn();
    const MockConfidentialClientApplication = vi.fn();
    const mockClientInit = vi.fn();
    return { mockAcquireToken, MockConfidentialClientApplication, mockClientInit };
  });

// ---------------------------------------------------------------------------
// Mocks (hoisted — must come before any imports that load the mocked modules)
// ---------------------------------------------------------------------------

vi.mock("isomorphic-fetch", () => ({}));

vi.mock("@azure/msal-node", () => ({
  ConfidentialClientApplication: MockConfidentialClientApplication,
}));

vi.mock("@microsoft/microsoft-graph-client", () => ({
  Client: {
    init: mockClientInit,
  },
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

function setValidEnv() {
  process.env.MONITOR_APP_CLIENT_ID = "test-client-id-12345";
  process.env.MONITOR_APP_TENANT_ID = "test-tenant-id-67890";
  process.env.MONITOR_APP_CERT_THUMBPRINT = "ABCD1234EFGH5678";
  process.env.MONITOR_APP_CERT_PEM = VALID_PEM_BASE64;
}

function clearEnv() {
  delete process.env.MONITOR_APP_CLIENT_ID;
  delete process.env.MONITOR_APP_TENANT_ID;
  delete process.env.MONITOR_APP_CERT_THUMBPRINT;
  delete process.env.MONITOR_APP_CERT_PEM;
}

beforeEach(() => {
  // Reset module registry to clear MSAL singleton between tests
  vi.resetModules();
  vi.clearAllMocks();

  // Re-configure mock implementations after clearAllMocks wipes them.
  // IMPORTANT: Use regular function (not arrow) — vi.fn() called with `new`
  // internally calls the implementation with `new`, and arrow functions cannot
  // be used as constructors (throws "ArrowFn is not a constructor").
  mockAcquireToken.mockResolvedValue({ accessToken: "mock-access-token-xyz" });
  MockConfidentialClientApplication.mockImplementation(function () {
    return { acquireTokenByClientCredential: mockAcquireToken };
  });
  mockClientInit.mockReturnValue({
    api: vi.fn().mockReturnValue({ get: vi.fn() }),
  });

  setValidEnv();
});

afterEach(() => {
  clearEnv();
});

// ---------------------------------------------------------------------------
// Token acquisition and Graph client creation
// ---------------------------------------------------------------------------

describe("getAppGraphClient — token acquisition", () => {
  it("returns a Graph Client object when env vars are valid", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    const client = await getAppGraphClient();

    expect(client).toBeDefined();
    expect(mockClientInit).toHaveBeenCalledTimes(1);
  });

  it("calls acquireTokenByClientCredential with Graph scope", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();

    expect(mockAcquireToken).toHaveBeenCalledWith({
      scopes: ["https://graph.microsoft.com/.default"],
    });
  });

  it("passes the access token to Client.init authProvider", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();

    expect(mockClientInit).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: expect.any(Function),
      })
    );

    // Verify authProvider calls done(null, accessToken)
    const authProvider = mockClientInit.mock.calls[0][0].authProvider;
    const doneMock = vi.fn();
    authProvider(doneMock);
    expect(doneMock).toHaveBeenCalledWith(null, "mock-access-token-xyz");
  });
});

// ---------------------------------------------------------------------------
// PEM decoding
// ---------------------------------------------------------------------------

describe("getAppGraphClient — PEM decoding", () => {
  it("decodes base64 PEM from env var and passes plain text to MSAL", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();

    const config = MockConfidentialClientApplication.mock.calls[0][0];
    const privateKey = config.auth.clientCertificate.privateKey;

    // Should be the decoded PEM, not the base64 string
    expect(privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(privateKey).toContain("-----END PRIVATE KEY-----");
    expect(privateKey).not.toBe(VALID_PEM_BASE64); // not raw base64
  });

  it("passes client ID and tenant ID from env vars to MSAL config", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();

    const config = MockConfidentialClientApplication.mock.calls[0][0];
    expect(config.auth.clientId).toBe("test-client-id-12345");
    expect(config.auth.authority).toContain("test-tenant-id-67890");
  });

  it("passes cert thumbprint from env var to MSAL config", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();

    const config = MockConfidentialClientApplication.mock.calls[0][0];
    expect(config.auth.clientCertificate.thumbprintSha256).toBe(
      "ABCD1234EFGH5678"
    );
  });
});

// ---------------------------------------------------------------------------
// MSAL singleton caching
// ---------------------------------------------------------------------------

describe("getAppGraphClient — MSAL singleton", () => {
  it("creates ConfidentialClientApplication only once across multiple calls", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    // Three calls — all should reuse the same MSAL instance
    await getAppGraphClient();
    await getAppGraphClient();
    await getAppGraphClient();

    expect(MockConfidentialClientApplication).toHaveBeenCalledTimes(1);
  });

  it("calls acquireTokenByClientCredential on every call (MSAL handles caching internally)", async () => {
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await getAppGraphClient();
    await getAppGraphClient();

    // acquireToken is called each time — MSAL's internal cache returns a valid token
    expect(mockAcquireToken).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Missing env vars
// ---------------------------------------------------------------------------

describe("getAppGraphClient — missing env vars throw", () => {
  it("throws when MONITOR_APP_CLIENT_ID is missing", async () => {
    delete process.env.MONITOR_APP_CLIENT_ID;
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow("MONITOR_APP_CLIENT_ID");
  });

  it("throws when MONITOR_APP_TENANT_ID is missing", async () => {
    delete process.env.MONITOR_APP_TENANT_ID;
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow("MONITOR_APP_TENANT_ID");
  });

  it("throws when MONITOR_APP_CERT_THUMBPRINT is missing", async () => {
    delete process.env.MONITOR_APP_CERT_THUMBPRINT;
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow(
      "MONITOR_APP_CERT_THUMBPRINT"
    );
  });

  it("throws when MONITOR_APP_CERT_PEM is missing", async () => {
    delete process.env.MONITOR_APP_CERT_PEM;
    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow("MONITOR_APP_CERT_PEM");
  });
});

// ---------------------------------------------------------------------------
// Invalid PEM content
// ---------------------------------------------------------------------------

describe("getAppGraphClient — invalid PEM content", () => {
  it("throws when decoded PEM does not contain BEGIN/PRIVATE KEY markers", async () => {
    // Base64-encode something that's NOT a PEM key
    process.env.MONITOR_APP_CERT_PEM = Buffer.from(
      "this is not a pem file at all"
    ).toString("base64");

    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow("MONITOR_APP_CERT_PEM");
  });

  it("throws when PEM has BEGIN marker but no PRIVATE KEY in it", async () => {
    process.env.MONITOR_APP_CERT_PEM = Buffer.from(
      "-----BEGIN CERTIFICATE-----\nMOCKDATA\n-----END CERTIFICATE-----"
    ).toString("base64");

    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow("MONITOR_APP_CERT_PEM");
  });
});

// ---------------------------------------------------------------------------
// MSAL returns no access token
// ---------------------------------------------------------------------------

describe("getAppGraphClient — MSAL returns no token", () => {
  it("throws when acquireTokenByClientCredential returns null", async () => {
    mockAcquireToken.mockResolvedValue(null);

    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow(
      "acquireTokenByClientCredential returned no access token"
    );
  });

  it("throws when acquireTokenByClientCredential returns result with no accessToken", async () => {
    mockAcquireToken.mockResolvedValue({ accessToken: null });

    const { getAppGraphClient } = await import("@/lib/graph/daemon-client");

    await expect(getAppGraphClient()).rejects.toThrow(
      "acquireTokenByClientCredential returned no access token"
    );
  });
});
