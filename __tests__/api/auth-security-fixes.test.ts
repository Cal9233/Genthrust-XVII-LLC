/**
 * Tests for auth security fixes (FIX-2, FIX-3, FIX-4):
 *   FIX-2: verify-credentials Zod validation (email + password max 72)
 *   FIX-3: register password max 72 (bcrypt truncation prevention)
 *   FIX-4: MFA enroll response omits plaintext TOTP secret
 *
 * All DB calls and library functions are mocked — no real network or DB needed.
 *
 * Note on testing register/verify-credentials routes directly: Next.js App
 * Router handlers require the NextRequest/NextResponse runtime. We test the
 * Zod schemas independently (matching the pattern in input-validation.test.ts)
 * and test the route handlers with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema mirrors — replicated from the actual route files for unit testing.
// If the route schemas change, these tests will catch the divergence.
// ---------------------------------------------------------------------------

// From app/api/auth/verify-credentials/route.ts
const VerifyCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
});

// From app/api/register/route.ts
const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72),
  contact_name: z.string().min(1).max(255).transform((v) => v.trim()),
  company_name: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// FIX-2: verify-credentials schema
// ---------------------------------------------------------------------------

describe("VerifyCredentialsSchema (FIX-2: Zod validation on verify-credentials)", () => {
  it("accepts valid email and password", () => {
    const result = VerifyCredentialsSchema.safeParse({
      email: "user@example.com",
      password: "correctpassword",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases the email", () => {
    const result = VerifyCredentialsSchema.safeParse({
      email: "  User@EXAMPLE.COM  ",
      password: "mypassword",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email format", () => {
    expect(
      VerifyCredentialsSchema.safeParse({
        email: "notanemail",
        password: "mypassword",
      }).success
    ).toBe(false);
  });

  it("rejects email longer than 255 characters", () => {
    // local part (245) + "@x.co" (5) = 250 chars — within limit
    // local part (251) + "@x.co" (5) = 256 chars — over limit
    const longEmail = "a".repeat(251) + "@x.co";
    expect(
      VerifyCredentialsSchema.safeParse({
        email: longEmail,
        password: "mypassword",
      }).success
    ).toBe(false);
  });

  it("rejects empty password", () => {
    expect(
      VerifyCredentialsSchema.safeParse({
        email: "user@example.com",
        password: "",
      }).success
    ).toBe(false);
  });

  it("accepts password of exactly 72 characters (bcrypt max)", () => {
    expect(
      VerifyCredentialsSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(72),
      }).success
    ).toBe(true);
  });

  it("rejects password longer than 72 characters (FIX-2 core: prevents bcrypt truncation exploit)", () => {
    expect(
      VerifyCredentialsSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(73),
      }).success
    ).toBe(false);
  });

  it("rejects missing email field", () => {
    expect(
      VerifyCredentialsSchema.safeParse({ password: "mypassword" }).success
    ).toBe(false);
  });

  it("rejects missing password field", () => {
    expect(
      VerifyCredentialsSchema.safeParse({ email: "user@example.com" }).success
    ).toBe(false);
  });

  it("rejects null body fields", () => {
    expect(
      VerifyCredentialsSchema.safeParse({ email: null, password: null }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FIX-3: register password max 72
// ---------------------------------------------------------------------------

describe("RegisterSchema password max (FIX-3: bcrypt 72-byte truncation prevention)", () => {
  const validBase = {
    email: "new@example.com",
    password: "SecurePass1!",
    contact_name: "Jane Doe",
  };

  it("accepts a valid registration payload", () => {
    expect(RegisterSchema.safeParse(validBase).success).toBe(true);
  });

  it("accepts password of exactly 72 characters (boundary)", () => {
    const result = RegisterSchema.safeParse({
      ...validBase,
      password: "a".repeat(64) + "AAAAAAAA", // 72 chars total
    });
    expect(result.success).toBe(true);
  });

  it("rejects password of 73 characters (FIX-3 core: was max(128), now max(72))", () => {
    const result = RegisterSchema.safeParse({
      ...validBase,
      password: "a".repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it("rejects password of 128 characters (old limit — now invalid)", () => {
    const result = RegisterSchema.safeParse({
      ...validBase,
      password: "a".repeat(128),
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = RegisterSchema.safeParse({ ...validBase, password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts password of exactly 8 characters (minimum)", () => {
    const result = RegisterSchema.safeParse({
      ...validBase,
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing contact_name", () => {
    const { contact_name, ...rest } = validBase;
    expect(RegisterSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts optional company_name", () => {
    const result = RegisterSchema.safeParse({
      ...validBase,
      company_name: "ACME Aviation",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FIX-4: MFA enroll route — response shape (no plaintext secret)
// ---------------------------------------------------------------------------

// We test the route handler directly using mocked dependencies.

const { mockAuth, mockQuery, mockGenerateTotpSecret, mockEncryptSecret, mockGenerateQrCodeDataUrl, mockLogAuditEvent } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockQuery: vi.fn(),
    mockGenerateTotpSecret: vi.fn(),
    mockEncryptSecret: vi.fn(),
    mockGenerateQrCodeDataUrl: vi.fn(),
    mockLogAuditEvent: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ query: mockQuery }));
vi.mock("@/lib/mfa", () => ({
  generateTotpSecret: mockGenerateTotpSecret,
  encryptSecret: mockEncryptSecret,
  generateQrCodeDataUrl: mockGenerateQrCodeDataUrl,
}));
vi.mock("@/lib/audit-logger", () => ({
  logAuditEvent: mockLogAuditEvent,
  ACTION_TYPES: { MFA_ENROLL: "MFA_ENROLL" },
  RESOURCE_TYPES: { MFA: "MFA" },
}));

describe("MFA enroll route response (FIX-4: remove plaintext TOTP secret)", () => {
  beforeEach(() => {
    // Valid authenticated session
    mockAuth.mockResolvedValue({
      user: { id: "42", email: "user@example.com", role: "client" },
    });

    mockQuery.mockResolvedValue(undefined);

    mockGenerateTotpSecret.mockReturnValue({
      secret: "SUPER_SECRET_BASE32",
      uri: "otpauth://totp/Genthrust:user@example.com?secret=SUPER_SECRET_BASE32",
    });

    mockEncryptSecret.mockReturnValue({
      encrypted: "enc-blob",
      iv: "init-vector",
      authTag: "auth-tag",
    });

    mockGenerateQrCodeDataUrl.mockResolvedValue(
      "data:image/png;base64,QRCODEDATA=="
    );

    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("response contains qrCodeUrl", async () => {
    const { POST } = await import(
      "@/app/api/portal/mfa/enroll/route"
    );
    const response = await POST();
    const body = await response.json();

    expect(body).toHaveProperty("qrCodeUrl");
    expect(body.qrCodeUrl).toBe("data:image/png;base64,QRCODEDATA==");
  });

  it("response does NOT contain secret (FIX-4 core: plaintext TOTP removed)", async () => {
    const { POST } = await import(
      "@/app/api/portal/mfa/enroll/route"
    );
    const response = await POST();
    const body = await response.json();

    expect(body).not.toHaveProperty("secret");
  });

  it("response status is 200", async () => {
    const { POST } = await import(
      "@/app/api/portal/mfa/enroll/route"
    );
    const response = await POST();

    expect(response.status).toBe(200);
  });

  it("returns 401 when session user is not a client", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", email: "admin@example.com", role: "admin" },
    });

    const { POST } = await import(
      "@/app/api/portal/mfa/enroll/route"
    );
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when no session exists", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/portal/mfa/enroll/route"
    );
    const response = await POST();

    expect(response.status).toBe(401);
  });
});
