# Security Audit Report — Genthrust-XVII-LLC
**Date:** 2026-03-16
**Auditor:** review-security agent (Claude Sonnet 4.6)
**Scope:** Full codebase security review — authentication, authorization, API routes, database, secrets, XSS, headers, MCP, dependencies

---

## Summary of Findings

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 7     |
| MEDIUM   | 8     |
| LOW      | 5     |
| **Total**| **23**|

---

## CRITICAL Findings

---

### CRIT-01: MCP Endpoint Fails Open When `MCP_API_KEY` Is Unset

**File:** `app/api/mcp/route.ts` — lines 33–45
**OWASP:** A07 Identification and Authentication Failures

**Vulnerable code:**
```ts
function checkAuth(request: Request): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    return process.env.MCP_ALLOW_UNAUTHENTICATED === 'true';
  }
  ...
}
```

**Attack vector:** If `MCP_API_KEY` is absent from the environment (e.g., misconfigured deployment, missing `.env.local`, or environment variable rotation failure), the entire MCP endpoint becomes publicly accessible without any credential. The opt-in escape hatch `MCP_ALLOW_UNAUTHENTICATED=true` makes the insecure path a named, documented feature, increasing the chance an operator enables it for convenience. The MCP endpoint exposes full database query access — all parts, all companies, all sales/repair orders, all invoices — to any unauthenticated caller.

**Remediation:** Fail closed, not open. If `MCP_API_KEY` is unset, deny all requests unconditionally. Remove `MCP_ALLOW_UNAUTHENTICATED` entirely. Use startup validation (e.g., a `startupCheck()` that throws if the key is missing) so a missing key causes the application to refuse to start rather than run in an insecure state.

---

### CRIT-02: `MCP_API_KEY` Compared with Timing-Unsafe String Equality

**File:** `app/api/mcp/route.ts` — line 44
**OWASP:** A02 Cryptographic Failures

**Vulnerable code:**
```ts
const token = authHeader.replace("Bearer ", "");
return token === apiKey;
```

**Attack vector:** JavaScript's `===` operator short-circuits on the first differing character. A timing-based oracle attack can enumerate the correct API key one character at a time by measuring response latency differences. For a 32-character key, this reduces the search space from 36^32 to 36*32 = 1152 guesses. This is a realistic attack on a locally-hosted or predictably-latency service.

**Remediation:** Use `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiKey))` for the comparison. Also validate that both buffers are the same length before comparing to avoid length-oracle attacks.

---

### CRIT-03: `BOT_DB_USER` Defaults to `root` in Inventory Database Connection

**File:** `lib/inventory-db.ts` — line 11
**OWASP:** A05 Security Misconfiguration

**Vulnerable code:**
```ts
user: process.env.BOT_DB_USER || 'root',
```

**Attack vector:** If `BOT_DB_USER` is missing from the environment, the application connects to the inventory MySQL database as `root`. This grants the application full administrative privileges over the database server, meaning a SQL injection vulnerability in any inventory query (or a compromised Node.js process) would give an attacker full control of the database server — including the ability to read all databases, execute `FILE` operations, or call `sys_exec` if the MySQL UDF is installed. Even without a SQL injection, this violates the principle of least privilege.

**Remediation:** Remove the `root` fallback entirely. The application must fail to start if `BOT_DB_USER` is not explicitly configured. Create a dedicated MySQL user with SELECT/INSERT/UPDATE/DELETE grants only on `genthrust_inventory`.

---

## HIGH Findings

---

### HIGH-01: Unauthenticated Company Name Enumeration Endpoint

**File:** `app/api/register/companies/route.ts` — lines 5–24
**OWASP:** A01 Broken Access Control

**Vulnerable code:**
```ts
export async function GET(request: Request) {
  // No authentication check
  const q = searchParams.get('q') || ''
  const companies = await query<any[]>(
    `SELECT id, company_name FROM companies WHERE company_name LIKE ? ...`
```

**Attack vector:** Any unauthenticated user (or automated scanner) can enumerate all company names in the database by issuing GET requests to `/api/register/companies?q=A`, `?q=B`, etc. This leaks the full customer roster of an aviation brokerage — which is competitively sensitive and potentially a precursor to targeted phishing of those clients. There is no rate limiting on this endpoint. The full company list can be extracted in under 1 minute with a 26-letter prefix sweep.

**Remediation:** Add authentication or at minimum aggressive rate limiting (3–5 requests per minute per IP). Consider whether public autocomplete is necessary at registration; if not, remove the route or restrict it to authenticated sessions.

---

### HIGH-02: Contact Form Has No Rate Limiting

**File:** `app/api/contact/route.ts`
**OWASP:** A04 Insecure Design

**Attack vector:** The contact form (`POST /api/contact`) performs no rate limiting by IP or session. An attacker can spam this endpoint to cause email flooding, server resource exhaustion, or bounce spam using Genthrust's sender domain. Every other sensitive endpoint in the codebase has rate limiting; this one is unprotected.

**Remediation:** Apply an IP-based rate limiter (e.g., 3 submissions per 10 minutes per IP) consistent with the pattern used in `app/api/register/route.ts`. Add CAPTCHA if this form is publicly accessible.

---

### HIGH-03: `next` Package Has Two Active High-Severity CVEs

**Source:** `npm audit` output, `package.json` line 52 (`"next": "^14.2.35"`)
**OWASP:** A06 Vulnerable and Outdated Components

**CVEs:**
- **GHSA-9g9p-9gw9-jx7f** — Next.js self-hosted applications vulnerable to DoS via Image Optimizer `remotePatterns` configuration
- **GHSA-h25m-26qc-wcjf** — Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components

**Attack vector:** Both CVEs are Denial-of-Service vectors that can be triggered by crafted HTTP requests against a self-hosted Next.js deployment. The application appears to be self-hosted (the project runs on a Windows machine with local bot processes). An attacker can render the portal and internal dashboard unavailable without authentication.

**Remediation:** Upgrade `next` to 15.x or the latest patched 14.x release. The `npm audit fix --force` suggestion upgrades to 16.x which is a breaking change — evaluate carefully, but the security upgrade is necessary.

---

### HIGH-04: `lodash.pick` Prototype Pollution (High Severity) and `flatted` DoS (High Severity) in Dependencies

**Source:** `npm audit` output
**OWASP:** A06 Vulnerable and Outdated Components

**Vulnerabilities:**
- **GHSA-p6mc-m468-83gw** — Prototype pollution in `lodash.pick` (pulled in via `@react-three/drei`)
- **GHSA-25h7-pfq9-p65f** — `flatted` unbounded recursion DoS in parse() revive phase

**Attack vector:** Prototype pollution in `lodash.pick` can allow an attacker who controls input to a lodash function to inject properties onto the global `Object.prototype`, potentially bypassing authorization checks or injecting malicious properties into downstream objects. The `flatted` DoS can be triggered by sending a specially crafted deeply-nested JSON structure to any endpoint that processes JSON through this library path.

**Remediation:** Run `npm audit fix` to resolve these. For `lodash.pick`, verify whether `@react-three/drei` actually uses it in a call path that processes user input; if so, it is a higher-priority fix.

---

### HIGH-05: In-Memory Rate Limiters Are Not Distributed — Bypassable in Serverless / Multi-Process Deployments

**Files:** `lib/rate-limit.ts`, `app/api/register/route.ts` (lines 7–21), `app/api/auth/verify-credentials/route.ts` (lines 16–35), `app/api/search/route.ts` (lines 6–20)
**OWASP:** A04 Insecure Design

**Attack vector:** All rate limiters use `Map<string, ...>` stored in Node.js module scope. If the application is ever deployed behind a load balancer with multiple Node.js workers, or on a serverless platform (Vercel, etc.), each worker/instance has an independent counter. An attacker can bypass the login brute-force limit (5 attempts per minute) by directing requests across multiple instances, multiplying the allowed attempts by the worker count. Even locally, Next.js in production mode can spawn multiple workers.

**Remediation:** Use a shared external store (Redis with `ioredis`, or a database-backed counter) for rate limit state. The `@upstash/ratelimit` library is a drop-in replacement that works with Vercel KV or Redis. At minimum, document that the application must run as a single-process server for the rate limiting to be effective.

---

### HIGH-06: `systeminformation` Command Injection (High Severity) in Trigger.dev Dependency Chain

**Source:** `npm audit` output
**OWASP:** A06 Vulnerable and Outdated Components

**CVEs:**
- **GHSA-wphj-fx3q-84ch** — `systeminformation` command injection via `fsSize()` on Windows
- **GHSA-5vv4-hvf7-2h46** — `systeminformation` command injection via `versions()` `locate` output
- **GHSA-9c88-49p5-5ggf** — `systeminformation` command injection via wifi interface parameter

**Attack vector:** `systeminformation` is pulled in through `@trigger.dev/sdk → @trigger.dev/core → @opentelemetry/host-metrics → systeminformation`. The command injection vulnerabilities affect Windows hosts specifically (`fsSize()` and wifi). This application runs on Windows. If any code path triggers the vulnerable functions with user-controlled input, OS-level command injection is possible. Even if not directly exploitable via the current call paths, this is a high-severity unpatched transitive dependency on a Windows host.

**Remediation:** Run `npm audit fix` which resolves this. Check Trigger.dev for updated SDK versions (`>=4.4.1`) that do not depend on the vulnerable `@opentelemetry/host-metrics` version.

---

### HIGH-07: MFA Reset Endpoint Has No Audit Log or Confirmation

**File:** `app/api/internal/clients/mfa-reset/route.ts` — lines 6–28
**OWASP:** A09 Security Logging and Monitoring Failures

**Vulnerable code:**
```ts
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'internal') { ... }
  const { userId } = await request.json()
  // Deletes all MFA factors and recovery codes — no audit log written
  await query(`DELETE FROM mfa_factors WHERE user_id = ?`, [userId])
  await query(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [userId])
  await query(`UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?`, [userId])
  return NextResponse.json({ success: true })
}
```

**Attack vector:** An internal user who performs an MFA reset (disabling a client's second factor) leaves no audit trail. This is a high-privilege operation — after reset, the client's account is accessible with only a password. A malicious insider or a compromised internal account could reset a client's MFA silently to facilitate account takeover, with no forensic record of who performed the action or when.

**Remediation:** Add a `logAuditEvent` call (matching the pattern used in `portal/mfa/disable/route.ts`) that records `action: ACTION_TYPES.MFA_DISABLE`, the `userId` being reset, the `user_id` and `user_email` of the internal user performing the reset, and a timestamp. Consider requiring a confirmation step or a secondary internal approval for this action.

---

## MEDIUM Findings

---

### MED-01: Missing `Content-Security-Policy` Header

**File:** `next.config.js` — lines 17–31
**OWASP:** A05 Security Misconfiguration

The security headers block sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, the legacy `X-XSS-Protection`, and `Permissions-Policy`. A `Content-Security-Policy` header is absent. Without CSP:
- `X-XSS-Protection` is deprecated and ignored by modern browsers
- If any XSS vector exists (reflected input, third-party script compromise), the browser has no fallback defense
- There is no `script-src` restriction to limit inline script execution

**Remediation:** Add a CSP header in `next.config.js`. At minimum: `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`. Use Next.js nonce-based CSP for server-rendered pages.

---

### MED-02: Missing `Strict-Transport-Security` (HSTS) Header

**File:** `next.config.js`
**OWASP:** A05 Security Misconfiguration

No `Strict-Transport-Security` header is configured. Without HSTS, a client who visits the site over HTTP (before a redirect) is vulnerable to SSL-stripping attacks. For a B2B aviation portal handling financial data, HTTPS enforcement at the HTTP layer is critical.

**Remediation:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to the headers block in `next.config.js`. Ensure the application is only served over HTTPS in production before setting the preload directive.

---

### MED-03: Portal Detail Endpoints Use `companyName` String Match for Authorization (IDOR Risk)

**Files:**
- `app/api/portal/invoices/[id]/route.ts` — line 34: `WHERE id = ? AND account_name = ?`
- `app/api/portal/sales-orders/[id]/route.ts` — line 34: `WHERE id = ? AND customer_name = ?`
- `app/api/portal/repair-orders/[id]/route.ts` — line 34: `WHERE id = ? AND vendor_name = ?`
**OWASP:** A01 Broken Access Control

**Attack vector:** Authorization is enforced by matching `companyName` from the JWT against a free-text column (`account_name`, `customer_name`, `vendor_name`) in the database. If two companies share a similar name (e.g., "Air Parts Inc" vs "Air Parts Inc - Branch"), or if a company name contains SQL wildcard characters that are later used in a LIKE query, or if the ERP system changes the canonical company name slightly, the match can fail silently or, worse, a client user could potentially access records of a similarly named company by manipulating their session token's `companyName`. The token is signed but the value originates from the database at login time — if that value is stale relative to the ERP, authorization fails open.

**Remediation:** Authorize by `company_id` (numeric FK) stored in the JWT rather than by string name. The `companyId` is already in the JWT (`token.companyId`). Rewrite the portal queries to: `WHERE id = ? AND company_id = ?` using the numeric ID. This eliminates string-matching authorization entirely.

---

### MED-04: Token Comparison Uses `replace("Bearer ", "")` Which Is Bypassable

**File:** `app/api/mcp/route.ts` — line 43
**OWASP:** A07 Identification and Authentication Failures

**Vulnerable code:**
```ts
const token = authHeader.replace("Bearer ", "");
```

`String.replace` only replaces the **first** occurrence. An `Authorization: Bearer Bearer actualtoken` header would extract `Bearer actualtoken` as the token, which would fail comparison. More critically, `Authorization: actualtoken` (no "Bearer " prefix) returns the full string including the prefix text, which would not match. The more subtle risk: `Authorization: Bearer ` (with trailing space) returns an empty string that is compared against the key. If `MCP_API_KEY` were somehow empty (not the case here but a defense-in-depth concern), this returns `true`.

**Remediation:** Parse the Authorization header using a standard pattern: `const [scheme, token] = authHeader.split(' '); if (scheme !== 'Bearer' || !token) return false;`. Then compare `token` against the key using `timingSafeEqual`.

---

### MED-05: ERP AERO Password Stored in Module-Level Singleton — Token Never Invalidated on Shutdown

**File:** `lib/erp-aero.ts` — lines 10–11, `lib/erp-client.ts` — lines 18–22
**OWASP:** A02 Cryptographic Failures

`cachedToken` is a module-level variable. In Next.js, module scope persists for the lifetime of the server process. The token is cached with no expiry in `erp-aero.ts` (only invalidated on 401). In `erp-client.ts` a 30-minute TTL exists but the token is never proactively refreshed — if a request occurs 29:59 after the last auth, the token is used, even if the ERP server invalidated it. There is no mechanism to rotate credentials or clear the cached token from an admin UI.

**Remediation:** Implement short TTL-based proactive refresh (as in `erp-client.ts`) consistently across both ERP client modules — `erp-aero.ts` currently has no TTL. Add a `clearTokenCache()` call on graceful shutdown. Consider storing the token in a short-lived encrypted store rather than plaintext module scope if the process may be inspectable.

---

### MED-06: `verify-credentials` Rate Limiter Increments Count on First Request, Then Blocks on ≥ MAX

**File:** `app/api/auth/verify-credentials/route.ts` — lines 24–35
**OWASP:** A07 Identification and Authentication Failures

**Vulnerable code:**
```ts
if (!entry || now > entry.resetAt) {
  rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  return false  // Not rate limited — allows the first attempt in a new window
}
if (entry.count >= RATE_LIMIT_MAX) { return true }
entry.count++
return false
```

The rate limiter creates a new entry with `count: 1` on the first call and returns `false` (not limited). Then it allows attempts until `count >= MAX`. This means the first attempt is counted but not gated, and then attempts 1 through MAX are allowed (total MAX attempts, not MAX-1). This is correct behavior, but the window resets silently after `resetAt` — meaning an attacker who knows the window length can time attacks to always start a new window, consistently getting MAX fresh attempts. With a 1-minute window and 5 attempts, a sustained attacker gets 5 attempts per minute per IP indefinitely.

More critically, the rate limiter is keyed by IP, which can be spoofed via `X-Forwarded-For` if no upstream proxy validates this header. The IP extraction code (`request.headers.get('x-forwarded-for')?.split(',')[0].trim()`) trusts the leftmost IP in the header, which a client can set to any value.

**Remediation:** Key the rate limiter by a combination of IP + email (from the request body) to prevent targeting many accounts from the same IP and to prevent IP spoofing. Never trust `X-Forwarded-For` unless it arrives from a trusted proxy. Consider progressive lockouts (longer backoff periods after each window exhaustion).

---

### MED-07: Bot Log Content Returned to Frontend May Contain Sensitive Operational Data

**File:** `app/api/internal/bots/logs/route.ts` and `lib/bot-helpers.ts` — `getLogTail()`
**OWASP:** A02 Cryptographic Failures / A09 Security Logging and Monitoring Failures

The `getLogTail` function reads raw log file content from `C:\GenthrustBot\logs\` and returns up to 500 lines directly to the browser. Log files from automated bots frequently contain:
- Email addresses of customers
- Part numbers with pricing
- Authentication tokens or session identifiers logged during debugging
- Error traces that reveal internal system architecture
- SQL queries logged at debug level

There is no sanitization or PII scrubbing before the log content is sent to the client.

**Remediation:** Filter log lines before transmission — strip lines containing patterns like email addresses, tokens, SQL queries, or stack traces. Limit line length in the response. Consider whether full log access belongs in the browser UI at all, versus an internal log aggregation system (Datadog, CloudWatch, etc.).

---

### MED-08: PDF Upload Does Not Validate File Magic Bytes — Only Checks Extension and MIME Type

**File:** `app/api/internal/inventory-intelligence/parse-pdf/route.ts` — lines 25–28
**OWASP:** A03 Injection

**Vulnerable code:**
```ts
if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
  return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
}
```

Both checks are client-controlled: `file.name` is set by the browser and `file.type` (MIME type) is derived from the browser's sniffing or the OS, not from actual file content. An attacker can upload a file with a `.pdf` extension and `application/pdf` content type that contains a malicious payload (e.g., a crafted PDF with embedded JavaScript that exploits a `pdf-parse` vulnerability, or a polyglot file that is both a valid PDF and another format). The actual file bytes are parsed by `pdf-parse` without content verification.

**Remediation:** Validate the file magic bytes: PDF files begin with `%PDF-` (`25 50 44 46 2D`). Read the first 5 bytes of the `arrayBuffer` and verify before passing to the parser. Additionally, keep `pdf-parse` updated and monitor for CVEs against it.

---

## LOW Findings

---

### LOW-01: `console.error` Logs Full Error Objects Including Stack Traces to Stdout

**Files:** Multiple — `lib/db.ts` line 37, `lib/inventory-db.ts` line 32, numerous API routes
**OWASP:** A09 Security Logging and Monitoring Failures

`console.error('Database query error:', error)` in `lib/db.ts` logs the full error object. In production Node.js, this includes the stack trace, which reveals internal file paths, line numbers, and query structure. If stdout is forwarded to a log aggregation service with insufficient access controls, or if an attacker gains access to server logs, they can extract internal architecture details useful for targeted attacks.

**Remediation:** In production, log only sanitized error messages (not full stack traces) to structured log output. Pass stack traces only to a secure internal telemetry system (e.g., Sentry, Datadog). The pattern already used in some routes (`error instanceof Error ? { message: error.message, stack: error.stack } : error`) is structured but still logs the stack — ensure this goes to a controlled sink.

---

### LOW-02: `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` Missing from `.env.example`

**File:** `.env.example`
**OWASP:** A05 Security Misconfiguration

`lib/graph/index.ts` line 43 references `process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`. This variable is not listed in `.env.example`. A developer setting up the project will be missing this required secret, which will cause a silent failure in Microsoft Graph token refresh (the `TokenRefreshError` will be thrown rather than the app failing to start). Missing tenant ID also means the `refreshAccessToken` function silently throws, which could result in email draft and send operations failing without clear error reporting.

**Remediation:** Add `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` to `.env.example` with an appropriate placeholder. Add a startup validation check for all required environment variables.

---

### LOW-03: `MCP_ALLOW_UNAUTHENTICATED` Environment Variable Documents an Insecure Mode

**File:** `app/api/mcp/route.ts` — line 37
**OWASP:** A05 Security Misconfiguration

The existence of `MCP_ALLOW_UNAUTHENTICATED=true` as a named, functional configuration option is itself a security issue. Documenting and shipping an "allow unauthenticated" mode creates an ongoing risk that a future deployment, misconfiguration event, or developer shortcut will inadvertently enable it. Security-critical controls should not have opt-out mechanisms baked into the codebase.

**Remediation:** Remove this escape hatch entirely (see CRIT-01). If unauthenticated local development access is needed, implement a separate development middleware that is only active when `NODE_ENV === 'development'` and logs a prominent warning.

---

### LOW-04: TOTP Window Allows ±1 Step (90-Second Validity Window)

**File:** `lib/mfa.ts` — line 70: `totp.validate({ token: code, window: 1 })`
**OWASP:** A07 Identification and Authentication Failures

`window: 1` allows TOTP codes from the previous step (30 seconds ago) and the next step (30 seconds in the future), giving each code a 90-second validity window. The TOTP RFC recommends `window: 1` for clock-drift tolerance, which is standard. However, the application does not track used TOTP codes (no "previously-seen token" database), meaning a single TOTP code is valid for the entire 90-second window and can be replayed within that window (e.g., captured via network interception and replayed within 90 seconds).

**Remediation:** Implement TOTP replay prevention: store the last successfully used code per user with a timestamp, and reject codes that have already been consumed within the same time step. This is a defense-in-depth measure against TOTP interception attacks.

---

### LOW-05: Recovery Codes Are 8 Characters from a 32-Character Alphabet — 40-Bit Entropy

**File:** `lib/mfa.ts` — lines 82–93
**OWASP:** A02 Cryptographic Failures

Recovery codes are 8 characters from a 32-character alphabet: `32^8 = 2^40 ≈ 1 trillion` combinations. This is acceptable for online brute force (rate-limited to 5 attempts per 5 minutes), but is below the NIST recommendation of at least 112 bits of entropy for high-value secrets. Standard recovery code implementations use 12–16 characters to provide 60–80 bits, which is more comfortable for long-term backup codes stored on physical paper.

**Remediation:** Increase recovery code length to 12 characters (`32^12 ≈ 2^60`) or use two groups of 8 characters separated by a dash for usability. The bcrypt hashing of recovery codes (12 rounds) adequately protects stored codes — the concern is the offline cracking scenario if the `mfa_recovery_codes` table is exfiltrated.

---

## Positive Security Observations

The following security practices are well-implemented and noteworthy:

- **Parameterized queries throughout**: All SQL in the codebase uses prepared statement placeholders (`?`). No string concatenation into SQL queries was found. This eliminates SQL injection.
- **bcrypt at 12 rounds**: Both `lib/password.ts` and recovery code hashing in `portal/mfa/verify/route.ts` use bcrypt with 12 rounds — appropriate for 2026 hardware.
- **Timing-safe comparison for MFA challenge tokens**: `lib/mfa.ts` line 136 uses `crypto.timingSafeEqual` correctly for JWT signature verification.
- **AES-256-GCM for TOTP secret encryption**: The TOTP secret encryption in `lib/mfa.ts` uses authenticated encryption with a random 16-byte IV per secret, with GCM auth tag verification. This is the correct approach.
- **Internal user blocked from client MFA flow**: `auth.ts` line 82 explicitly blocks `@genthrust.net` email addresses from passing through the MFA challenge flow.
- **Role enforced at session callback, not just middleware**: `auth.config.ts` line 111 defaults to `'client'` if role is unknown, preventing privilege escalation through a missing `role` claim.
- **MFA is enforced before portal access**: The `authorized()` callback in `auth.config.ts` lines 36–38 correctly redirects non-MFA clients to `/portal/mfa-setup` before they can access any portal content.
- **Bot restart uses `execFileSync`/`execFile` with a fixed argument list**: `lib/bot-helpers.ts` line 61 and `app/api/internal/bots/restart/route.ts` line 37 use `execFileSync`/`execFileAsync` with a fixed service name from a registry whitelist — this avoids shell injection even though the service name comes from user input (the `botName` is validated against `BOT_REGISTRY` before use).
- **Portal IDOR mitigation via company binding**: Portal detail endpoints (`invoices/[id]`, `sales-orders/[id]`, `repair-orders/[id]`) bind the record lookup to the authenticated user's company, preventing horizontal data access. (See MED-03 for the weakness in this approach.)
- **Audit logging on all sensitive operations**: Login, MFA enrollment, MFA disable, bot restart, email send, and client management operations all emit audit log entries.

---

## Remediation Priority Order

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | CRIT-01: MCP fails open without API key | 15 min |
| 2 | CRIT-02: MCP token timing-unsafe comparison | 15 min |
| 3 | CRIT-03: Inventory DB defaults to root | 15 min |
| 4 | HIGH-01: Unauthenticated company enumeration | 30 min |
| 5 | HIGH-03/04/06: npm audit — Next.js CVEs, lodash, systeminformation | 1 hour |
| 6 | HIGH-07: MFA reset missing audit log | 20 min |
| 7 | HIGH-02: Contact form no rate limiting | 30 min |
| 8 | MED-01: Add Content-Security-Policy | 2 hours |
| 9 | MED-02: Add HSTS header | 15 min |
| 10 | MED-03: IDOR — use companyId not companyName | 1 hour |
| 11 | MED-06: Rate limiter trusts X-Forwarded-For | 1 hour |
| 12 | HIGH-05: In-memory rate limiters not distributed | 4 hours (Redis) |
| 13 | MED-04: Bearer token parsing | 15 min |
| 14 | MED-07: Log scrubbing before frontend delivery | 2 hours |
| 15 | MED-08: PDF magic byte validation | 30 min |
| 16 | LOW-02: Missing env var in .env.example | 5 min |
| 17 | LOW-04: TOTP replay prevention | 2 hours |
| 18 | LOW-05: Recovery code entropy | 15 min |

---

*This report was generated by automated static analysis and manual code review. It does not constitute a penetration test and may not capture all vulnerabilities. Dynamic testing, dependency scanning with continuous monitoring, and periodic re-audits are recommended.*
