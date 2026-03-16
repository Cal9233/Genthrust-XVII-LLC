# Optimization Plan: Genthrust-XVII-LLC

**Generated:** 2026-03-16T18:00:00Z
**Optimizer Agent** | Claude Opus 4.6 (MAX effort)
**Scope:** Security, Performance, Correctness, Frontend, Backend, Infrastructure

---

## Executive Summary

- **Target:** Genthrust-XVII-LLC Next.js 14 aviation parts distribution platform
- **Input:** 4 audit reports (23 security, 20 performance, 22 correctness, 452 tests passing)
- **Total proposals:** 52 optimizations (P0: 8, P1: 16, P2: 18, P3: 10)
- **Estimated total effort:** 45-60 engineering hours
- **Expected outcomes:**
  - Eliminate 3 CRITICAL and 7 HIGH security vulnerabilities
  - Reduce alarm check latency from 10s to ~1s (50 watched parts)
  - Reduce ERP API calls per automation page from 60 to 5-20
  - Remove ~120 KB gzipped JS from bots route initial bundle
  - Add FULLTEXT search (10-100x faster part lookups at scale)
  - Fix race condition in ERP token management
  - Add missing test coverage for MFA, auth, rate limiting

---

## Priority Levels

| Level | Meaning | SLA |
|-------|---------|-----|
| **P0-Critical** | Actively exploitable, data exposure, or crash-on-production | Fix within 24 hours |
| **P1-High** | Significant security/performance/correctness risk | Fix within 1 week |
| **P2-Medium** | Moderate improvement, defense-in-depth | Fix within 2 weeks |
| **P3-Low** | Polish, future-proofing, minor improvements | Fix within 1 month |

---

# P0-CRITICAL

---

### OPT-001 | Security | P0-Critical
**Title:** MCP endpoint fails open when `MCP_API_KEY` is unset

**Current State:**
- **File:** `app/api/mcp/route.ts`, lines 33-37
- When `MCP_API_KEY` is unset, `checkAuth()` returns `process.env.MCP_ALLOW_UNAUTHENTICATED === 'true'`
- If both vars are unset, it returns `false` (safe), but `MCP_ALLOW_UNAUTHENTICATED=true` is a documented escape hatch
- The MCP endpoint exposes the entire database (parts, companies, ROs, SOs, invoices) via 10 AI tools

**Proposed Fix:**
```ts
// app/api/mcp/route.ts — lines 33-37
function checkAuth(request: Request): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    // FAIL CLOSED — no key = no access, period
    console.error('[MCP] DENIED: MCP_API_KEY is not configured. All requests blocked.');
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  // Timing-safe comparison (fixes OPT-002)
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
  } catch {
    return false; // Different lengths
  }
}
```
- Remove `MCP_ALLOW_UNAUTHENTICATED` env var entirely from `.env.example` and all code references
- Add startup validation in `next.config.js` or a middleware-level check

**Expected Impact:** Eliminates unauthenticated database access via MCP. Zero performance cost.
**Risk:** If someone currently relies on `MCP_ALLOW_UNAUTHENTICATED=true` in dev, they must set `MCP_API_KEY`. Low risk since this is a security improvement.
**Audit References:** Security CRIT-01, LOW-03

---

### OPT-002 | Security | P0-Critical
**Title:** MCP API key compared with timing-unsafe `===`

**Current State:**
- **File:** `app/api/mcp/route.ts`, line 44
- `return token === apiKey` — JavaScript `===` short-circuits on first differing character
- Enables timing oracle attack: 32-char key reduces to ~1152 guesses

**Proposed Fix:**
Merged into OPT-001 above — use `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(apiKey))`.
Also fix the `Bearer` parsing at line 43: `authHeader.replace("Bearer ", "")` only replaces first occurrence. Replace with proper split parsing.

**Expected Impact:** Eliminates timing oracle attack on MCP API key.
**Risk:** None. Drop-in replacement.
**Audit References:** Security CRIT-02, MED-04

---

### OPT-003 | Security | P0-Critical
**Title:** Inventory database defaults to `root` user

**Current State:**
- **File:** `lib/inventory-db.ts`, line 11
- `user: process.env.BOT_DB_USER || 'root'` — fallback to MySQL root
- `.env.example` line 28 also shows `BOT_DB_USER=root` as the example value

**Proposed Fix:**
```ts
// lib/inventory-db.ts — line 11
// Remove root fallback — fail explicitly if not configured
const dbUser = process.env.BOT_DB_USER;
if (!dbUser) {
  throw new Error('BOT_DB_USER environment variable is required — refusing to connect as root');
}
// ... use dbUser in pool config
```
- Update `.env.example` to show `BOT_DB_USER=genthrust_inventory_ro` (or whatever the actual restricted user is)
- Create a dedicated MySQL user: `GRANT SELECT, INSERT, UPDATE, DELETE ON genthrust_inventory.* TO 'gt_inv_app'@'%'`

**Expected Impact:** Eliminates root DB access on misconfiguration.
**Risk:** App will fail to start if `BOT_DB_USER` is missing — this is the desired behavior. Must ensure env var is set in all deployment environments.
**Audit References:** Security CRIT-03

---

### OPT-004 | Correctness | P0-Critical
**Title:** Race condition in dual ERP token managers

**Current State:**
- **Files:** `lib/erp-aero.ts` (lines 10-11, 43-48, 58-60) AND `lib/erp-client.ts` (lines 18-20, 65-78)
- Two independent token caching layers exist for the same ERP API
- `erp-aero.ts`: No TTL, `cachedToken` cleared on 401, re-auth immediate
- `erp-client.ts`: 30-min TTL, `cachedToken` with `tokenExpiresAt`
- Both are module-level variables (not `globalThis`), lost on hot reload
- On 401: both clear `cachedToken = null` and retry — if concurrent requests hit 401 simultaneously, two parallel `authenticate()`/`signin()` calls fire, potentially invalidating each other's session

**Proposed Fix:**
1. **Consolidate to ONE ERP token manager** in `lib/erp-client.ts` (the better implementation with TTL)
2. Anchor token state to `globalThis`:
```ts
// lib/erp-client.ts
const g = globalThis as unknown as {
  _erpAuth: { token: string | null; expiresAt: number; promise: Promise<string> | null } | undefined
}
g._erpAuth ??= { token: null, expiresAt: 0, promise: null }
```
3. After awaiting an in-flight `authPromise`, re-check `cachedToken` before returning:
```ts
async function getHeaders(): Promise<Record<string, string>> {
  const auth = g._erpAuth!;
  if (!auth.token || Date.now() >= auth.expiresAt) {
    if (auth.promise) {
      await auth.promise;
    } else {
      auth.promise = signin().finally(() => { auth.promise = null });
      await auth.promise;
    }
    // Defensive: verify token was actually set
    if (!auth.token) {
      throw new Error('ERP authentication failed — token not obtained after signin');
    }
  }
  return { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' };
}
```
4. **Migrate `erp-aero.ts` callers** (`getPartsList`, `getPartDetails`, `clearTokenCache`) to use `erp-client.ts` functions, then delete `erp-aero.ts`

**Expected Impact:** Eliminates token race condition, prevents dual-session invalidation, survives hot reload.
**Risk:** Medium — requires updating all `erp-aero.ts` imports. Must test ERP API calls after migration. `getPartsList` and `getPartDetails` call paths must be verified.
**Agent Memory Context:** `erp-aero.ts` is the "basic client" and `erp-client.ts` is the "production client" per CLAUDE.md. The production client is the correct target.
**Audit References:** Correctness C-1, H-5; Performance L7

---

### OPT-005 | Performance | P0-Critical
**Title:** N+1 sequential HTTP calls in watchlist alarm checker

**Current State:**
- **File:** `app/api/internal/inventory-alarms/check/route.ts`, lines 22-71
- For each watchlist item: 1 sequential ERP API call + 1 sequential DB UPDATE
- 50 watched parts = 50 serial HTTP requests (~200ms each) = **10+ seconds minimum**
- Each ERP call also goes through token cache logic

**Proposed Fix:**
```ts
// 1. Parallelize ERP calls with concurrency limiter (5 at a time)
import pLimit from 'p-limit';
const limit = pLimit(5);

const results = await Promise.allSettled(
  watchlist.map(item =>
    limit(async () => {
      const liveData = await getPartLiveData(item.part_number, item.condition_code);
      return { item, liveData };
    })
  )
);

// 2. Batch DB updates using multi-row UPDATE
const updates: [number, number][] = []; // [currentQty, id]
const alarmInserts: [string, string, string][] = []; // [type, partNum, details]

for (const result of results) {
  if (result.status === 'rejected') continue;
  const { item, liveData } = result.value;
  // ... compute currentQty, check alarm conditions, push to arrays
}

// Single bulk UPDATE
if (updates.length > 0) {
  const cases = updates.map(([qty, id]) => `WHEN id = ${id} THEN ${qty}`).join(' ');
  const ids = updates.map(([, id]) => id).join(',');
  await inventoryQuery(
    `UPDATE inventory_watchlist SET last_known_qty = CASE ${cases} END, last_checked_at = NOW() WHERE id IN (${ids})`
  );
}

// Single bulk INSERT for alarms
if (alarmInserts.length > 0) {
  const placeholders = alarmInserts.map(() => '(?, ?, ?, NOW())').join(',');
  const params = alarmInserts.flat();
  await inventoryQuery(
    `INSERT INTO inventory_alerts (alert_type, part_number, details, created_at) VALUES ${placeholders}`,
    params
  );
}
```

**Expected Impact:** 50 parts: **10s+ down to ~2s** (5 concurrent * 200ms * 10 batches = 2s). DB writes: 50 queries down to 2.
**Risk:** `p-limit` is a new dependency (~2KB). ERP API may have rate limits — 5 concurrent is conservative. Test with actual watchlist size.
**Audit References:** Performance C1, M6; Correctness M-9

---

### OPT-006 | Correctness | P0-Critical
**Title:** MFA enrollment does not return TOTP secret for manual entry

**Current State:**
- **File:** `app/api/portal/mfa/enroll/route.ts`, line 61
- Returns `{ qrCodeUrl }` — does NOT include `secret`
- **File:** `components/portal/MfaEnrollment.tsx`, line 36
- Reads `data.secret` — gets `undefined`
- Manual entry UI shows empty `<code>` element; copy button copies "undefined"

**Proposed Fix:**
```ts
// app/api/portal/mfa/enroll/route.ts — line 61
return NextResponse.json({ qrCodeUrl, secret })
```
The `secret` variable (base32 TOTP secret) is already in scope at line 30. It is the pre-encryption value and is safe to return to the authenticated user who is enrolling.

**Expected Impact:** Fixes manual MFA enrollment for users who cannot scan QR codes (accessibility requirement for B2B aviation platform).
**Risk:** None. The secret is already displayed as a QR code — returning it as text is equivalent exposure.
**Audit References:** Correctness H-4

---

### OPT-007 | Security | P0-Critical
**Title:** Next.js has active high-severity CVEs including RCE

**Current State:**
- **File:** `package.json`, line 50: `"next": "^14.2.35"`
- npm audit shows: GHSA-9g9p-9gw9-jx7f (DoS via Image Optimizer), GHSA-h25m-26qc-wcjf (DoS via React Server Components)
- Additionally, CVE-2025-66478 (RCE in React Server Components) affects Next.js <14.2.26 — but `^14.2.35` should include the patch if installed recently
- Must verify actual installed version and run `npx fix-react2shell-next` to check

**Proposed Fix:**
1. Run `npm audit` to get current vulnerability list
2. Run `npx fix-react2shell-next` to check for React/Next.js RCE patches
3. Update to latest patched Next.js 14.x: `npm install next@14.2.35` (verify this is actually the latest 14.x)
4. Run `npm audit fix` for transitive dependencies (lodash.pick, flatted, systeminformation)
5. If Next.js 14.x patches are insufficient, evaluate upgrading to Next.js 15.x (breaking change analysis required)

**Expected Impact:** Eliminates known DoS and potential RCE vectors.
**Risk:** Medium — Next.js minor version updates can have subtle breaking changes. Full test suite must pass after upgrade. `npm audit fix --force` may introduce breaking changes in transitive deps.
**Audit References:** Security HIGH-03, HIGH-04, HIGH-06

---

### OPT-008 | Security | P0-Critical
**Title:** Admin MFA reset accepts unvalidated `userId` with no audit log

**Current State:**
- **File:** `app/api/internal/clients/mfa-reset/route.ts`, lines 13-21
- `userId` taken directly from request body with only truthiness check
- No validation that userId is a positive integer
- No validation that target is a client account (not internal)
- No audit log for this high-privilege operation
- Three DELETE/UPDATE queries execute without existence check

**Proposed Fix:**
```ts
// app/api/internal/clients/mfa-reset/route.ts
const { userId } = await request.json();

// Validate userId is a positive integer
const parsedId = parseInt(userId, 10);
if (!parsedId || parsedId <= 0 || !Number.isInteger(parsedId)) {
  return NextResponse.json({ error: 'userId must be a positive integer' }, { status: 400 });
}

// Verify target is a client user, not an internal user
const [targetUser] = await query<any[]>(
  'SELECT id, email, contact_name FROM portal_users WHERE id = ?',
  [parsedId]
);
if (!targetUser) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

// Execute MFA reset
await query('DELETE FROM mfa_factors WHERE user_id = ?', [parsedId]);
await query('DELETE FROM mfa_recovery_codes WHERE user_id = ?', [parsedId]);
await query('UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?', [parsedId]);

// Audit log
await logAuditEvent({
  action: ACTION_TYPES.MFA_DISABLE,
  resource_type: RESOURCE_TYPES.MFA,
  resource_id: String(parsedId),
  user_id: String((session.user as any).id),
  user_email: session.user.email || '',
  user_role: 'internal',
  success: true,
  status_code: 200,
  metadata: { target_user_email: targetUser.email, target_user_name: targetUser.contact_name },
});
```

**Expected Impact:** Prevents MFA reset on arbitrary/invalid IDs, creates forensic trail for insider threat detection.
**Risk:** None. Adds validation and logging to an existing privileged endpoint.
**Audit References:** Security HIGH-07; Correctness H-1

---

# P1-HIGH

---

### OPT-009 | Performance | P1-High
**Title:** Triple-fetching `v1/ro/list` pages per automation request

**Current State:**
- **File:** `lib/erp-client.ts`, lines 154, 184, 214, 288
- `getActiveRepairOrders`, `getNet30PaymentDates`, `getFollowupROs` each independently call `fetchAllPages('v1/ro/list')`
- In automation route's `Promise.all`, all three run — up to **60 sequential HTTP requests** where 20 would suffice

**Proposed Fix:**
```ts
// lib/erp-client.ts — add shared fetch function
export async function getAllRepairOrderItems(): Promise<any[]> {
  return fetchAllPages('v1/ro/list');
}

// Modify each function to accept pre-fetched items:
export async function getActiveRepairOrders(limit = 50, prefetchedItems?: any[]): Promise<ERPRepairOrder[]> {
  const items = prefetchedItems ?? await fetchAllPages('v1/ro/list');
  // ... existing filter logic
}
// Same pattern for getNet30PaymentDates and getFollowupROs

// In automation/route.ts:
const allROItems = await getAllRepairOrderItems();
const [net30, followups, purchaseOrders, repairOrders] = await Promise.all([
  getNet30PaymentDates(allROItems),
  getFollowupROs(allROItems),
  getOpenPurchaseOrders(), // different endpoint, fine
  getActiveRepairOrders(50, allROItems),
]);
```

**Expected Impact:** ERP API calls reduced from ~60 to ~20 per automation page load. Latency reduced by ~66%.
**Risk:** Low. All three functions already process the same data — just eliminating redundant fetches.
**Audit References:** Performance H1

---

### OPT-010 | Performance | P1-High
**Title:** `fetchAllPages` uses page_size=25 (too small)

**Current State:**
- **File:** `lib/erp-client.ts`, line 131: `page_size: '25'`
- 500 items = 20 sequential HTTP requests

**Proposed Fix:**
```ts
// lib/erp-client.ts, line 131
page_size: '100',  // 500 items in 5 pages instead of 20
```
Validate against ERP AERO API documentation that page_size=100 is supported. Test with `getPartsList` in `erp-aero.ts` which already uses `pageSize=100` (line 100), confirming the API supports it.

**Expected Impact:** 4x reduction in HTTP round-trips per paginated fetch. Combined with OPT-009: automation page goes from ~60 requests to ~5.
**Risk:** Low. `erp-aero.ts` already uses 100. Verify ERP API doesn't throttle differently for larger pages.
**Audit References:** Performance H2

---

### OPT-011 | Performance | P1-High
**Title:** Add FULLTEXT index on `parts` search columns

**Current State:**
- **File:** `app/api/search/route.ts`, lines 39-62
- Five `LIKE '%query%'` predicates on `parts` table — forces full table scan every search
- At 10K+ parts: noticeable lag. At 100K+: production outage risk.

**Proposed Fix:**
1. Create migration:
```sql
ALTER TABLE parts ADD FULLTEXT INDEX ft_parts_search
  (product_name, description, mfr_part_no, nsn_number, cage_code);
```
2. Update search query:
```ts
// For queries >= 3 characters: use FULLTEXT
const sql = searchQuery.length >= 3
  ? `SELECT ... FROM parts
     WHERE MATCH(product_name, description, mfr_part_no, nsn_number, cage_code)
     AGAINST(? IN BOOLEAN MODE)
     ORDER BY MATCH(product_name, description, mfr_part_no, nsn_number, cage_code)
     AGAINST(? IN BOOLEAN MODE) DESC
     LIMIT 100`
  : `SELECT ... FROM parts
     WHERE product_name LIKE ? OR mfr_part_no LIKE ?
     ORDER BY product_name LIMIT 100`;
// FULLTEXT params: append * for prefix matching
const ftQuery = searchQuery.trim().split(/\s+/).map(w => `+${w}*`).join(' ');
```
3. Add secondary index: `CREATE INDEX idx_parts_product_name ON parts(product_name);`

**Expected Impact:** Search latency at 100K parts: full table scan (~500ms+) down to indexed FULLTEXT (~5-50ms). 10-100x improvement.
**Risk:** FULLTEXT index increases storage by ~20-30% of text column size. Minimum 3-character query for FULLTEXT. Must run migration on production DB.
**Audit References:** Performance H4

---

### OPT-012 | Performance | P1-High
**Title:** Anchor inventory DB pool to `globalThis`

**Current State:**
- **File:** `lib/inventory-db.ts`, lines 3-20
- Module-level `let pool` — recreated on every hot reload in dev, every cold start in serverless
- `lib/db.ts` correctly uses `globalThis.rawMysqlPool ??= ...`

**Proposed Fix:**
```ts
// lib/inventory-db.ts
const globalForInventory = globalThis as unknown as { inventoryPool: mysql.Pool | undefined }

globalForInventory.inventoryPool ??= mysql.createPool({
  host: process.env.BOT_DB_HOST || 'localhost',
  port: parseInt(process.env.BOT_DB_PORT || '3306'),
  user: process.env.BOT_DB_USER, // No 'root' fallback (OPT-003)
  password: process.env.BOT_DB_PASSWORD || '',
  database: process.env.BOT_DB_NAME || 'genthrust_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
})

const pool = globalForInventory.inventoryPool
```

**Expected Impact:** Prevents connection pool leak on hot reload. Prevents exhausting MySQL max_connections.
**Risk:** None. Same pattern used successfully in `lib/db.ts`.
**Audit References:** Performance H3; Correctness M-10

---

### OPT-013 | Performance | P1-High
**Title:** Dynamic import Recharts on bots page

**Current State:**
- **File:** `app/internal/bots/page.tsx`, lines 12-16
- Static imports of `LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid` from recharts
- Recharts: ~400 KB minified, ~120 KB gzipped — loaded immediately on bots page entry

**Proposed Fix:**
Create a wrapper component:
```tsx
// components/internal/BotsCharts.tsx
'use client'
import dynamic from 'next/dynamic'

const BotFleetChart = dynamic(
  () => import('./charts/BotFleetChart'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-int-surface rounded-lg" /> }
)

const BotMetricsPie = dynamic(
  () => import('./charts/BotMetricsPie'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-int-surface rounded-lg" /> }
)

export { BotFleetChart, BotMetricsPie }
```
Move the actual chart rendering (with recharts imports) into `charts/BotFleetChart.tsx` and `charts/BotMetricsPie.tsx`.

**Expected Impact:** Removes ~120 KB gzipped from initial bots page JS bundle. Charts load after first paint.
**Risk:** Low. Skeleton loading state during chart load. Users see charts ~200ms later.
**Agent Memory Context:** Frontend agent chose recharts for the dashboard revamp (Phase 4: "Recharts dark theme across all charts"). The library choice is correct — only the import strategy needs optimization.
**Audit References:** Performance H5

---

### OPT-014 | Security | P1-High
**Title:** Unauthenticated company name enumeration endpoint

**Current State:**
- **File:** `app/api/register/companies/route.ts`, lines 5-24
- No authentication check — any user can enumerate all company names
- No rate limiting — full company list extractable in <1 minute with 26-letter prefix sweep

**Proposed Fix:**
```ts
// Add rate limiting (reuse existing createRateLimiter pattern)
const companySearchLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 1000,
  name: 'company-search',
});

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const { allowed, retryAfterSeconds } = companySearchLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }
  companySearchLimiter.record(ip);

  // Require minimum 3-character query to prevent full enumeration
  const q = searchParams.get('q') || '';
  if (q.length < 3) {
    return NextResponse.json([]);
  }
  // ... existing query logic
}
```

**Expected Impact:** Prevents customer roster enumeration. 5 requests/minute is sufficient for registration autocomplete.
**Risk:** None. Registration autocomplete still works with >= 3 character queries.
**Audit References:** Security HIGH-01

---

### OPT-015 | Security | P1-High
**Title:** Contact form has no rate limiting

**Current State:**
- **File:** `app/api/contact/route.ts`
- No rate limiting by IP or session
- Can be used for email flooding, sender domain reputation damage, or server resource exhaustion

**Proposed Fix:**
```ts
const contactLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000, // 3 per 10 minutes
  name: 'contact-form',
});
// Apply at top of POST handler, same pattern as register/route.ts
```

**Expected Impact:** Prevents contact form spam. 3 per 10 minutes per IP is generous for legitimate use.
**Risk:** None.
**Audit References:** Security HIGH-02

---

### OPT-016 | Security | P1-High
**Title:** Add Content-Security-Policy header

**Current State:**
- **File:** `next.config.js`, lines 17-30
- Has X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy
- Missing CSP — no defense against XSS via injected scripts

**Proposed Fix:**
```js
// next.config.js — add to headers array
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline needed for Next.js; migrate to nonce-based later
    "style-src 'self' 'unsafe-inline'", // Tailwind injects inline styles
    "img-src 'self' data: blob:",  // QR codes use data: URIs
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://wapi.erp.aero https://graph.microsoft.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
```
Note: `'unsafe-inline'` is needed initially for Next.js. Phase 2: migrate to nonce-based CSP using Next.js `nonce` support.

**Expected Impact:** Prevents cross-site script execution from unauthorized origins.
**Risk:** Medium — CSP can break legitimate functionality if too restrictive. Must test thoroughly: Three.js canvas, QR code generation (data: URIs), Recharts SVG, Microsoft Graph API calls.
**Audit References:** Security MED-01

---

### OPT-017 | Security | P1-High
**Title:** Add Strict-Transport-Security (HSTS) header

**Current State:**
- **File:** `next.config.js`
- No HSTS header — clients visiting over HTTP vulnerable to SSL-stripping

**Proposed Fix:**
```js
// next.config.js — add to headers array
{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
```
Omit `preload` initially until confirmed the app is HTTPS-only in all environments.

**Expected Impact:** Forces HTTPS for 1 year after first visit. Prevents SSL-stripping attacks on B2B aviation portal.
**Risk:** Low — only add if app is served over HTTPS in production. Do NOT add if any HTTP access is needed.
**Audit References:** Security MED-02

---

### OPT-018 | Correctness | P1-High
**Title:** NaN offset on non-numeric `page` parameter in 3 routes

**Current State:**
- **Files:** `app/api/internal/invoices/route.ts`, `sales-orders/route.ts`, `repair-orders/route.ts` — all line 16
- `parseInt(params.get('page') || '1')` — returns NaN for `?page=abc`
- NaN offset in SQL LIMIT clause — undefined behavior

**Proposed Fix:**
```ts
// Apply to all 3 routes — same pattern as audit-log/route.ts
const page = Math.max(1, parseInt(params.get('page') || '1') || 1)
```

**Expected Impact:** Prevents NaN propagation to SQL queries. 1-line fix per route.
**Risk:** None.
**Audit References:** Correctness H-2

---

### OPT-019 | Correctness | P1-High
**Title:** `tail` binary not available on Windows production deployment

**Current State:**
- **File:** `lib/bot-helpers.ts`, line 97
- `execFileSync('tail', ...)` — POSIX binary, not available on Windows Server
- Bot infrastructure runs on Windows (`BOT_LOG_DIR = 'C:\\GenthrustBot\\logs'`, services use `sc query`)

**Proposed Fix:**
Replace with pure-Node tail implementation:
```ts
export function getLogTail(botKey: string, lines: number = 100): { content: string; sizeBytes: number } {
  const bot = BOT_REGISTRY[botKey];
  if (!bot) throw new Error(`Unknown bot: ${botKey}`);
  const logPath = path.join(BOT_LOG_DIR, bot.logFile);

  try {
    const stat = fs.statSync(logPath);
    // Read last ~50KB (sufficient for 100 lines at ~500 chars each)
    const readSize = Math.min(stat.size, 50 * 1024);
    const fd = fs.openSync(logPath, 'r');
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const content = buffer.toString('utf-8');
    const allLines = content.split('\n');
    return {
      content: allLines.slice(-lines).join('\n'),
      sizeBytes: stat.size,
    };
  } catch {
    return { content: `Log file not found: ${logPath}`, sizeBytes: 0 };
  }
}
```

**Expected Impact:** Bot logs now work on Windows production. Also more efficient than reading entire file.
**Risk:** Low. The new implementation reads only the last 50KB regardless of file size.
**Audit References:** Correctness H-3; Performance M5

---

### OPT-020 | Correctness | P1-High
**Title:** MFA challenge token `parseInt(payload.sub)` without validation

**Current State:**
- **File:** `lib/mfa.ts`, line 148
- `parseInt(payload.sub)` — returns NaN on non-numeric input
- NaN passed to SQL `WHERE user_id = ?` — mysql2 serializes as 0

**Proposed Fix:**
```ts
// lib/mfa.ts — after HMAC verification
if (!payload.sub || !/^\d+$/.test(payload.sub)) {
  return null; // Invalid sub claim
}
return {
  userId: parseInt(payload.sub, 10),
  email: payload.email,
};
```

**Expected Impact:** Prevents NaN/0 userId in MFA verification SQL queries.
**Risk:** None. Adds validation after existing HMAC check.
**Audit References:** Correctness H-6

---

### OPT-021 | Security | P1-High
**Title:** Portal detail endpoints use `companyName` string match for authorization

**Current State:**
- **Files:** Portal invoices/[id], sales-orders/[id], repair-orders/[id] — all line 34
- Authorization: `WHERE id = ? AND account_name = ?` (string match against JWT `companyName`)
- Vulnerable to name collisions, name changes, and stale JWT values

**Proposed Fix:**
```ts
// All 3 portal detail routes — change from:
WHERE id = ? AND account_name = ?  // string match
// To:
WHERE id = ? AND company_id = ?    // numeric FK match

// The JWT already contains companyId (per CLAUDE.md: "token.companyId")
const companyId = parseInt((session.user as any).companyId, 10);
```

**Expected Impact:** Eliminates string-matching authorization. Numeric FK is deterministic and immune to name changes.
**Risk:** Low. Must verify `companyId` is populated in the JWT for all portal users. Check that the `repair_orders`, `sales_orders`, and `invoices` tables have a `company_id` column (if not, this requires a schema migration to add FK).
**Audit References:** Security MED-03

---

### OPT-022 | Performance | P1-High
**Title:** Make `getAllBotStatuses()` async and cache result

**Current State:**
- **File:** `app/api/internal/status-overview/route.ts`, lines 63-72
- `getAllBotStatuses()` calls `execFileSync('sc', ...)` for each of 5 services sequentially
- Blocks Node.js event loop — up to 25 seconds if services are unavailable

**Proposed Fix:**
```ts
// lib/bot-helpers.ts — add async version
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Cache with 30s TTL
let cachedStatuses: BotStatusResult[] | null = null;
let statusCacheExpiry = 0;

export async function getAllBotStatusesAsync(): Promise<BotStatusResult[]> {
  if (cachedStatuses && Date.now() < statusCacheExpiry) return cachedStatuses;

  const results = await Promise.allSettled(
    Object.entries(BOT_REGISTRY).map(async ([key, bot]) => {
      try {
        const { stdout } = await execFileAsync('sc', ['query', bot.serviceName], { timeout: 3000 });
        const status: BotStatus = stdout.includes('RUNNING') ? 'RUNNING' :
          stdout.includes('STOPPED') ? 'STOPPED' : 'UNKNOWN';
        return { key, displayName: bot.displayName, serviceName: bot.serviceName, status, description: bot.description };
      } catch {
        return { key, displayName: bot.displayName, serviceName: bot.serviceName, status: 'UNKNOWN' as BotStatus, description: bot.description };
      }
    })
  );

  cachedStatuses = results.filter(r => r.status === 'fulfilled').map(r => (r as any).value);
  statusCacheExpiry = Date.now() + 30_000;
  return cachedStatuses;
}
```

**Expected Impact:** Event loop never blocked. All 5 service checks run in parallel (~3s max vs 25s). 30s cache eliminates redundant checks on dashboard refresh.
**Risk:** Low. Cached status may be up to 30s stale — acceptable for dashboard display.
**Audit References:** Performance M4

---

### OPT-023 | Correctness | P1-High
**Title:** Duplicate MySQL connection pools to same database

**Current State:**
- **File:** `lib/db.ts` — uses `globalThis.rawMysqlPool`, connectionLimit 10
- **File:** `lib/db/index.ts` — uses `globalThis.mysqlPool`, connectionLimit 10
- Two pools to the same DB = up to 20 connections when 10 expected
- Different env var fallback naming: `DB_HOST` vs `DATABASE_HOST`

**Proposed Fix:**
```ts
// lib/db/index.ts — import pool from lib/db.ts instead of creating a new one
import { getPool } from '@/lib/db';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

export const pool = getPool();
export const db = drizzle(pool, { schema, mode: 'default' });
```
Remove the duplicate pool creation from `lib/db/index.ts`.

**Expected Impact:** Halves MySQL connection usage. Eliminates env var fallback inconsistency.
**Risk:** Low. Both pools connect to the same DB — consolidating is safe. Must verify all Drizzle operations work with the raw pool.
**Audit References:** Correctness M-1

---

### OPT-024 | Correctness | P1-High
**Title:** Inventory alarm conflates "part not found" with "quantity = 0"

**Current State:**
- **File:** `app/api/internal/inventory-alarms/check/route.ts`, lines 25-31
- `currentQty` initialized to 0
- If `liveData.length === 0` (ERP returned no results for that part number), `currentQty` stays 0
- This triggers a depletion alarm on next check if `previousQty > 0`

**Proposed Fix:**
```ts
let currentQty = 0;
let partFound = false;

try {
  const liveData = await getPartLiveData(item.part_number, item.condition_code);
  if (liveData.length > 0) {
    partFound = true;
    currentQty = liveData.reduce((sum, d) => sum + d.quantity, 0);
  }
} catch (err) {
  console.error(`ERP check failed for ${item.part_number}:`, err);
  continue; // Skip this item entirely on ERP error
}

// Only trigger alarm if part was actually found with qty=0
// If part was not found in ERP search, preserve last_known_qty
if (!partFound) continue;
```

**Expected Impact:** Eliminates false depletion alarms when ERP search returns no results (different from actual zero stock).
**Risk:** Low. Watchlist items for parts not found in ERP will preserve their last_known_qty rather than being falsely zeroed.
**Audit References:** Correctness M-9

---

# P2-MEDIUM

---

### OPT-025 | Security | P2-Medium
**Title:** Rate limiter trusts `X-Forwarded-For` from untrusted clients

**Current State:**
- **File:** `app/api/auth/verify-credentials/route.ts`, line 23; `app/api/search/route.ts`, line 23
- `request.headers.get('x-forwarded-for')?.split(',')[0].trim()` — client can spoof any IP

**Proposed Fix:**
For the login rate limiter specifically, key by IP + email combination:
```ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
const { email } = await request.json();
const rateLimitKey = `${ip}:${email}`; // attacker must know both IP and email
```
Document that `X-Forwarded-For` must be set by a trusted proxy if deployed behind a load balancer.

**Expected Impact:** Prevents IP spoofing from bypassing login rate limits.
**Risk:** Low.
**Audit References:** Security MED-06

---

### OPT-026 | Security | P2-Medium
**Title:** ERP token not proactively refreshed in `erp-aero.ts`

**Current State:** Consolidated into OPT-004 (single token manager). No separate action needed.
**Audit References:** Security MED-05

---

### OPT-027 | Security | P2-Medium
**Title:** Bot log content may contain sensitive data returned to frontend

**Current State:**
- **File:** `app/api/internal/bots/logs/route.ts` and `lib/bot-helpers.ts` — `getLogTail()`
- Raw log lines (up to 500) returned directly to browser
- May contain: email addresses, part numbers with pricing, auth tokens, SQL queries, stack traces

**Proposed Fix:**
```ts
// lib/bot-helpers.ts — add sanitization function
function sanitizeLogLine(line: string): string {
  return line
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]')
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/token[=:]\s*[A-Za-z0-9\-._~+/]+=*/gi, 'token=[REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
}

// Apply in getLogTail before returning
const sanitized = tail.split('\n').map(sanitizeLogLine).join('\n');
return { content: sanitized, sizeBytes: stat.size };
```

**Expected Impact:** Prevents PII and credential leakage via log viewer.
**Risk:** Low. Regex patterns may over-match in some edge cases — test with actual bot log samples.
**Audit References:** Security MED-07

---

### OPT-028 | Security | P2-Medium
**Title:** PDF upload does not validate file magic bytes

**Current State:**
- **File:** `app/api/internal/inventory-intelligence/parse-pdf/route.ts`, lines 25-28
- Only checks `file.name` extension and `file.type` MIME — both client-controlled

**Proposed Fix:**
```ts
const buffer = Buffer.from(await file.arrayBuffer());
// Validate PDF magic bytes: %PDF- (hex: 25 50 44 46 2D)
if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
  return NextResponse.json({ error: 'Invalid PDF file — magic bytes do not match' }, { status: 400 });
}
```

**Expected Impact:** Prevents non-PDF files from reaching `pdf-parse` library.
**Risk:** None.
**Audit References:** Security MED-08

---

### OPT-029 | Performance | P2-Medium
**Title:** Connect `useReducedMotion` hook to animation components

**Current State:**
- **File:** `hooks/useReducedMotion.ts` — exists but never imported
- Components with heavy animations: HeroIntro, ParticleVertexAircraft, MagneticButton, InstrumentCluster
- Users with `prefers-reduced-motion: reduce` get full 35K-particle WebGL, continuous Framer Motion, TelemetryTicker

**Proposed Fix:**
```tsx
// In HeroIntro.tsx / ParticleVertexAircraft/index.tsx:
import { useReducedMotion } from '@/hooks/useReducedMotion';

const reduceMotion = useReducedMotion();

// If reduced motion: render static logo instead of Three.js canvas
{reduceMotion ? (
  <Image src="/GenLogoNoBackground.png" alt="Genthrust" width={400} height={400} />
) : (
  <Canvas>...</Canvas>
)}

// In MagneticButton.tsx: disable magnetic effect
const handleMouseMove = useCallback((e) => {
  if (reduceMotion || isTouchDevice.current || !buttonRef.current) return;
  // ...
}, [reduceMotion, ...]);

// In InstrumentCluster.tsx: disable TelemetryTicker interval
useEffect(() => {
  if (reduceMotion) return;
  const interval = setInterval(...);
  return () => clearInterval(interval);
}, [reduceMotion]);
```

**Expected Impact:** Accessibility compliance (WCAG 2.1 AA). GPU/CPU savings for users who requested reduced motion.
**Risk:** Low. Graceful degradation to static content.
**Agent Memory Context:** The UX research report (web-research-scout) explicitly recommended: "`prefers-reduced-motion` media query: all animations should respect it" and "Framer Motion auto-respects this via `useReducedMotion()`". The hook was created but the connection was missed during implementation.
**Audit References:** Performance M1

---

### OPT-030 | Performance | P2-Medium
**Title:** Detail view API routes use `SELECT *`

**Current State:**
- **Files:** `app/api/internal/repair-orders/[id]/route.ts`, `invoices/[id]/route.ts`, `sales-orders/[id]/route.ts`, `quotes/[id]/route.ts`, `app/api/mcp/route.ts` (lines 292-393)
- `SELECT *` fetches all columns including large TEXT fields and ERP sync metadata

**Proposed Fix:**
Replace with explicit column lists matching what the UI actually renders. Example for repair orders:
```sql
SELECT id, erp_po_id, ro_number, vendor_name, status, priority, due_date,
       total, contact_name, payment_terms, ship_via, erp_created_at, erp_modified_at
FROM repair_orders WHERE id = ?
```

**Expected Impact:** Reduces response payload by ~30-50% per detail view. Faster serialization.
**Risk:** Low. Must verify all fields used by DrawerMetaGrid and DrawerLineItems components.
**Audit References:** Performance M2

---

### OPT-031 | Performance | P2-Medium
**Title:** `getBotMetrics` reads entire log files into memory

**Current State:**
- **File:** `lib/bot-helpers.ts`, lines 132-156
- `fs.readFileSync(logPath, 'utf-8')` — entire file, synchronous
- 5 bots per request = potentially 50MB+ allocated

**Proposed Fix:**
Use the improved `getLogTail` from OPT-019 (pure-Node partial read) to get last 1000 lines, then filter for today's date:
```ts
export function getBotMetrics(botKey: string): Record<string, number> {
  const patterns = METRIC_PATTERNS[botKey];
  if (!patterns) return {};
  const bot = BOT_REGISTRY[botKey];
  const logPath = path.join(BOT_LOG_DIR, bot.logFile);
  const today = new Date().toISOString().split('T')[0];

  try {
    // Read only last 100KB (enough for ~2000 lines)
    const stat = fs.statSync(logPath);
    const readSize = Math.min(stat.size, 100 * 1024);
    const fd = fs.openSync(logPath, 'r');
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const content = buffer.toString('utf-8');
    const todayLines = content.split('\n').filter(line => line.includes(today));
    // ... existing metric counting logic
  } catch {
    return Object.fromEntries(patterns.map(p => [p.label, 0]));
  }
}
```

**Expected Impact:** Memory per bots request: 50MB potential down to ~500KB max. No event loop blocking.
**Risk:** Low. May miss metrics from very early in the day if log file > 100KB of today's entries — unlikely for bot logs.
**Audit References:** Performance M5; Correctness M-5

---

### OPT-032 | Performance | P2-Medium
**Title:** Dashboard poll fires when browser tab is hidden

**Current State:**
- **File:** `components/internal/DashboardClient.tsx`, lines 49-53
- `setInterval(loadOverview, 60_000)` fires even when tab is hidden

**Proposed Fix:**
```tsx
useEffect(() => {
  loadOverview();
  const interval = setInterval(loadOverview, 60_000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      loadOverview(); // Refresh immediately on tab focus
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, []);
```
Also wrap `loadOverview` in `useCallback`:
```tsx
const loadOverview = useCallback(async () => { ... }, []);
```

**Expected Impact:** Reduces server load from AFK users. Immediate refresh on tab return.
**Risk:** None.
**Audit References:** Performance M7; Correctness L-2

---

### OPT-033 | Correctness | P2-Medium
**Title:** `JSON.parse(q.part_numbers)` can throw on malformed DB data

**Current State:**
- **Files:** `app/api/internal/quotes/route.ts` line 57, `quotes/[id]/route.ts` line 35, `quotes/[id]/send/route.ts` line 71, `quotes/export/route.ts` line 36
- No try/catch around `JSON.parse` — one corrupt row breaks entire list/export

**Proposed Fix:**
```ts
// lib/utils/safe-json.ts
export function safeParseJson<T = any>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return value as T ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// Usage in all 4 files:
part_numbers: safeParseJson(q.part_numbers, []),
```

**Expected Impact:** One corrupt row no longer breaks the entire quotes list/export.
**Risk:** None. Graceful degradation.
**Audit References:** Correctness M-3

---

### OPT-034 | Correctness | P2-Medium
**Title:** Quote PATCH SQL has string interpolation (not parameterized)

**Current State:**
- **File:** `app/api/internal/quotes/[id]/route.ts`, lines 68-73
- `processed_at = ${processedAt}` — interpolated directly into SQL
- Status IS validated against allowlist before this point, but pattern is dangerous

**Proposed Fix:**
```ts
// Replace with two explicit queries
if (status === 'processed' || status === 'responded') {
  await query(
    'UPDATE quote_requests SET status = ?, processed_at = NOW(), updated_at = NOW() WHERE id = ?',
    [status, id]
  );
} else {
  await query(
    'UPDATE quote_requests SET status = ?, updated_at = NOW() WHERE id = ?',
    [status, id]
  );
}
```

**Expected Impact:** Eliminates SQL interpolation. Fully parameterized.
**Risk:** None.
**Audit References:** Correctness M-4

---

### OPT-035 | Correctness | P2-Medium
**Title:** Portal dashboard destructures COUNT results without null guards

**Current State:**
- **File:** `app/api/portal/dashboard/route.ts`, lines 31-35
- `const [[ { activeSOs } ]] = ...` — throws if query returns empty array

**Proposed Fix:**
```ts
const results = await Promise.all([...]);
const [activeSOs] = (results[0] as any[])?.[0] ? [results[0][0]] : [{ activeSOs: 0 }];
// Or use safeCount pattern from status-overview/route.ts
```

**Expected Impact:** Graceful degradation on DB errors instead of 500.
**Risk:** None.
**Audit References:** Correctness M-7

---

### OPT-036 | Correctness | P2-Medium
**Title:** `M365_GRAPH_ACCESS_TOKEN` is a static env var that expires after 1 hour

**Current State:**
- **Files:** `app/api/internal/quotes/[id]/send/route.ts` line 19, `quotes/sync/route.ts` line 40
- Microsoft Graph OAuth2 tokens expire after 1 hour
- No refresh logic, no expiry check

**Proposed Fix:**
Implement MSAL client credentials flow:
```ts
// lib/graph/token.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}`,
  },
});

export async function getGraphToken(): Promise<string> {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return result!.accessToken;
}
```
Replace static env var usage with `getGraphToken()` calls.

**Expected Impact:** Email send and quote sync features work indefinitely instead of failing after 1 hour.
**Risk:** Medium. Requires `@azure/msal-node` dependency. Must verify client credentials flow is configured in Azure Entra ID app registration.
**Audit References:** Correctness M-8

---

### OPT-037 | Correctness | P2-Medium
**Title:** Admin create-client has no email format or password strength validation

**Current State:**
- **File:** `app/api/admin/create-client/route.ts`, lines 22-29
- Only truthiness check on email, password, contact_name
- 1-character passwords allowed; invalid email format stored

**Proposed Fix:**
```ts
// Reuse the same validation as register/route.ts
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
}
if (!password || password.length < 8) {
  return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
}
```

**Expected Impact:** Admin-created accounts have same credential quality as self-registered accounts.
**Risk:** None.
**Audit References:** Correctness M-11

---

### OPT-038 | Performance | P2-Medium
**Title:** `MagneticButton` triggers React re-render at 60fps during mouse movement

**Current State:**
- **File:** `components/ui/MagneticButton.tsx`, lines 48-59
- `lerp` function calls `setPosition(...)` which triggers React state update on every animation frame
- Two MagneticButton instances on hero = 120 React reconciliations per second during mouse movement

**Proposed Fix:**
```tsx
// Replace React state with direct DOM manipulation
const lerp = useCallback(() => {
  currentRef.current.x += (targetRef.current.x - currentRef.current.x) * magneticStrength;
  currentRef.current.y += (targetRef.current.y - currentRef.current.y) * magneticStrength;

  // Direct DOM update — bypasses React reconciliation
  if (buttonRef.current) {
    buttonRef.current.style.transform =
      `translate(${currentRef.current.x}px, ${currentRef.current.y}px)`;
  }

  if (
    Math.abs(targetRef.current.x - currentRef.current.x) > 0.1 ||
    Math.abs(targetRef.current.y - currentRef.current.y) > 0.1
  ) {
    animationRef.current = requestAnimationFrame(lerp);
  } else {
    animationRef.current = null;
  }
}, [magneticStrength]);
```
Remove `const [position, setPosition] = useState(...)` and the `style={{ transform: ... }}` prop that reads from state.

**Expected Impact:** Eliminates 60fps React reconciliation during mouse movement. Pure GPU-accelerated CSS transform.
**Risk:** Low. The `motion.button` from Framer Motion may conflict with direct style manipulation — test thoroughly. May need to apply transform via a wrapper div instead.
**Agent Memory Context:** MagneticButton was part of the original "Aviation-Tech Premium" design language. The magnetic effect is intentional — we are optimizing the implementation, not removing the feature.
**Audit References:** Performance L2

---

### OPT-039 | Correctness | P2-Medium
**Title:** `getNotificationFeed` error-pattern regex floods feed from crashing bots

**Current State:**
- **File:** `lib/bot-helpers.ts`, lines 167-178
- `NOTIFICATION_PATTERNS[8]` matches `/error|failed|exception/i`
- A crashing bot producing 1000 error lines/day fills feed with identical error notifications

**Proposed Fix:**
```ts
// Cap notifications per bot per severity
const MAX_PER_BOT_PER_SEVERITY = 5;
const counts = new Map<string, number>();

for (const line of lines) {
  for (const { pattern, severity } of NOTIFICATION_PATTERNS) {
    if (pattern.test(line)) {
      const key = `${botKey}:${severity}`;
      const count = counts.get(key) || 0;
      if (count >= MAX_PER_BOT_PER_SEVERITY) break;
      counts.set(key, count + 1);
      // ... push notification
      break;
    }
  }
}
```

**Expected Impact:** Notification feed remains useful even when a bot is crashing repeatedly.
**Risk:** None.
**Audit References:** Correctness M-6

---

### OPT-040 | Infrastructure | P2-Medium
**Title:** Add missing `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` to `.env.example`

**Current State:**
- **File:** `.env.example` — missing this variable
- `lib/graph/index.ts` line 43 references it
- Missing = silent failure in Graph token refresh

**Proposed Fix:**
Add to `.env.example`:
```
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="your-tenant-id"
```

**Expected Impact:** Prevents silent Graph API failure for new deployments.
**Risk:** None.
**Audit References:** Security LOW-02

---

### OPT-041 | Infrastructure | P2-Medium
**Title:** Add startup validation for required environment variables

**Current State:** No startup validation — missing env vars cause silent failures at runtime.

**Proposed Fix:**
```ts
// lib/env-check.ts
const REQUIRED_VARS = [
  'AUTH_SECRET',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'BOT_DB_HOST', 'BOT_DB_USER', 'BOT_DB_PASSWORD',
  'MFA_ENCRYPTION_KEY',
  'MCP_API_KEY',
  'ERP_AERO_CID', 'ERP_AERO_EMAIL', 'ERP_AERO_PASSWORD',
];

export function validateEnvironment(): void {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `See .env.example for required configuration.`
    );
  }
}

// Call in next.config.js or app/layout.tsx server component
```

**Expected Impact:** App fails fast on misconfiguration instead of failing silently at runtime.
**Risk:** Low. Must ensure all required vars are set in all environments (dev, staging, prod).
**Audit References:** Security CRIT-01 (MCP_API_KEY), CRIT-03 (BOT_DB_USER), LOW-02 (tenant ID)

---

### OPT-042 | Correctness | P2-Medium
**Title:** Hardcoded Windows path in `bot-helpers.ts`

**Current State:**
- **File:** `lib/bot-helpers.ts`, line 44
- `const BOT_LOG_DIR = 'C:\\GenthrustBot\\logs'` — fails silently on Linux/Docker

**Proposed Fix:**
```ts
const BOT_LOG_DIR = process.env.BOT_LOG_DIR || 'C:\\GenthrustBot\\logs';
```
Add `BOT_LOG_DIR` to `.env.example`.

**Expected Impact:** Bot logs work in any environment.
**Risk:** None.
**Audit References:** Correctness L-6

---

# P3-LOW

---

### OPT-043 | Performance | P3-Low
**Title:** In-memory rate limiter maps are unbounded

**Current State:**
- **Files:** `app/api/search/route.ts` line 6, `lib/rate-limit.ts` line 35
- Maps grow indefinitely — stale entries only evicted on re-check

**Proposed Fix:**
Add periodic cleanup to `createRateLimiter`:
```ts
// Sweep expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);
```
Also add sweep to the inline `searchAttempts` map in `search/route.ts`.

**Expected Impact:** Prevents unbounded memory growth under sustained varied-IP traffic.
**Risk:** None.
**Audit References:** Performance L1

---

### OPT-044 | Performance | P3-Low
**Title:** Add `Cache-Control: no-store` to authenticated API responses

**Current State:** All internal API routes return data with no explicit cache headers.

**Proposed Fix:**
Create a helper:
```ts
// lib/api-helpers.ts
export function jsonResponse(data: any, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}
```
Replace `NextResponse.json(data)` calls in all `app/api/internal/**` routes.

**Expected Impact:** Prevents accidental proxy caching of authenticated responses.
**Risk:** None.
**Audit References:** Performance L6

---

### OPT-045 | Performance | P3-Low
**Title:** `AnimatedCounter` runs 10 concurrent rAF loops on dashboard load

**Current State:**
- **File:** `components/ui/AnimatedCounter.tsx`, lines 31-48
- StatusOverviewGrid renders ~10 counters, each with independent rAF loop for 600ms

**Proposed Fix:**
Use Framer Motion's `animate()` with shared timing:
```tsx
import { useMotionValue, useTransform, animate } from 'framer-motion';

export function AnimatedCounter({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, v => Math.round(v));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.6 });
    return controls.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}
```

**Expected Impact:** Framer Motion internally batches animations under a single rAF. 10 counters share one tick.
**Risk:** Low. Visual behavior is identical.
**Audit References:** Performance L5

---

### OPT-046 | Performance | P3-Low
**Title:** `TelemetryTicker` uses nested timers

**Current State:**
- **File:** `components/Hero/InstrumentCluster.tsx`, lines 165-173
- `setInterval` wrapping `setTimeout` — two state updates per 3.5s tick

**Proposed Fix:**
Replace with single `setInterval` + CSS opacity transition:
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    setIndex(prev => (prev + 1) % items.length);
  }, 3500);
  return () => clearInterval(interval);
}, []);
```
Use CSS `transition: opacity 0.3s` on the ticker element instead of React state for visibility.

**Expected Impact:** Eliminates nested timer and halves state updates per tick.
**Risk:** None.
**Audit References:** Performance L4

---

### OPT-047 | Security | P3-Low
**Title:** TOTP replay prevention

**Current State:**
- **File:** `lib/mfa.ts`, line 70: `totp.validate({ token: code, window: 1 })`
- 90-second validity window, no used-code tracking
- Same TOTP code can be replayed within the window

**Proposed Fix:**
```ts
// Add to mfa_factors table: last_used_code TEXT, last_used_at DATETIME
// In verifyTotpCode:
if (factor.last_used_code === code) {
  return false; // Replay detected
}
// After successful verification:
await query('UPDATE mfa_factors SET last_used_code = ?, last_used_at = NOW() WHERE id = ?', [code, factor.id]);
```

**Expected Impact:** Prevents TOTP code replay within the 90-second window.
**Risk:** Low. Requires schema migration to add `last_used_code` column.
**Audit References:** Security LOW-04

---

### OPT-048 | Security | P3-Low
**Title:** Increase recovery code entropy

**Current State:**
- **File:** `lib/mfa.ts`, lines 82-93
- 8 chars from 32-char alphabet = 2^40 entropy (40 bits)
- NIST recommends >= 112 bits for high-value secrets

**Proposed Fix:**
```ts
// Increase to 12 characters: 32^12 = 2^60 (60 bits)
const code = Array.from(crypto.getRandomValues(new Uint8Array(12)))
  .map(b => ALPHABET[b % ALPHABET.length])
  .join('');
// Format as two groups for readability: XXXX-XXXX-XXXX
const formatted = `${code.slice(0,4)}-${code.slice(4,8)}-${code.slice(8,12)}`;
```

**Expected Impact:** Increases offline brute-force difficulty by factor of 32^4 = ~1 million.
**Risk:** Low. Must handle both old (8-char) and new (12-char) formats during transition.
**Audit References:** Security LOW-05

---

### OPT-049 | Correctness | P3-Low
**Title:** Login rate limiter counts successful attempts

**Current State:**
- **File:** `app/api/auth/verify-credentials/route.ts`, lines 22-34
- Counts ALL requests toward limit (success and failure)
- Legitimate user logging in 5 times in 1 minute gets locked out

**Proposed Fix:**
Refactor to use the shared `createRateLimiter` utility (which separates `check`, `record`, and `reset`):
```ts
const loginLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 1000,
  name: 'login',
});
// In handler:
const { allowed } = loginLimiter.check(ip);
if (!allowed) return 429;
// ... verify credentials
if (!valid) {
  loginLimiter.record(ip); // Only count failures
  return 401;
}
loginLimiter.reset(ip); // Clear on success
```

**Expected Impact:** Legitimate users are never locked out by successful logins.
**Risk:** None. Consistent with MFA verify/disable pattern.
**Audit References:** Correctness L-5

---

### OPT-050 | Correctness | P3-Low
**Title:** CSV export does not escape newlines in field values

**Current State:**
- **File:** `app/api/internal/quotes/export/route.ts`, lines 39-45
- Replaces double-quotes but not `\n`, `\r\n`

**Proposed Fix:**
```ts
function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}
```

**Expected Impact:** Prevents CSV corruption from multiline field values.
**Risk:** None.
**Audit References:** Correctness L-4

---

### OPT-051 | Infrastructure | P3-Low
**Title:** Structured error logging instead of full stack traces

**Current State:**
- **Files:** `lib/db.ts` line 37, `lib/inventory-db.ts` line 32, numerous API routes
- `console.error('...', error)` logs full error objects including stack traces

**Proposed Fix:**
```ts
// lib/logger.ts
export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ context, message, timestamp: new Date().toISOString() }));
  }
}
```
Replace raw `console.error` calls with `logError(context, error)`.

**Expected Impact:** Production logs contain structured JSON without stack traces. Dev retains full error output.
**Risk:** None. Stack traces still available via error monitoring service (Sentry, etc.) if configured.
**Audit References:** Security LOW-01

---

### OPT-052 | Correctness | P3-Low
**Title:** Remove stale `aircraft.glb` model from public directory

**Current State:**
- **File:** `public/models/aircraft.glb` — 404 KB
- Performance audit notes it may not be currently used

**Proposed Fix:**
Verify no component references `aircraft.glb`. If unused, remove from `public/models/`.

**Expected Impact:** Removes 404 KB from static assets.
**Risk:** Low. Verify before deleting.
**Audit References:** Performance — image optimization section

---

# Test Coverage Additions

These are not numbered as optimizations but are prerequisites for safe implementation of the above.

### TC-001 | Test | P1-High
**Title:** Add test coverage for `lib/mfa.ts`

**What to test:**
- `encryptSecret`/`decryptSecret` round-trip
- `decryptSecret` with tampered authTag — should throw
- `verifyTotpCode` with valid, expired, and invalid codes
- `verifyMfaChallengeToken` with valid, expired, wrong-secret, non-numeric sub
- Recovery code generation and hashing

**Audit References:** Correctness TG-1

---

### TC-002 | Test | P1-High
**Title:** Add test coverage for `auth.ts` credential authorize logic

**What to test:**
- Mode A: email+password success, wrong password fail, `@genthrust.net` block, MFA-enabled block
- Mode B: valid TOTP, valid recovery code (marks used), expired challenge, invalid code

**Audit References:** Correctness TG-2

---

### TC-003 | Test | P1-High
**Title:** Add test coverage for `lib/rate-limit.ts`

**What to test:**
- `check()` returns allowed before threshold, denied at/above
- `record()` increments, `reset()` clears
- Window expiry behavior
- `retryAfterSeconds` accuracy

**Audit References:** Correctness TG-3

---

### TC-004 | Test | P1-High
**Title:** Add test coverage for ERP clients

**What to test (with mocked fetch):**
- `getToken()` deduplicates concurrent auth requests
- 401 triggers re-auth and retry
- `fetchAllPages` stops when items empty
- Malformed JSON handling

**Audit References:** Correctness TG-4

---

# Implementation Roadmap

| Phase | Proposals | Prerequisites | Estimated Effort | Priority |
|-------|-----------|--------------|-----------------|----------|
| **Immediate (Day 1)** | OPT-001, OPT-002, OPT-003, OPT-006, OPT-008, OPT-018, OPT-020 | None | 2-3 hours | P0 |
| **Day 1-2** | OPT-007 (npm audit fix), OPT-012, OPT-017, OPT-023 | None | 2-3 hours | P0-P1 |
| **Week 1** | OPT-004 (ERP consolidation), OPT-005, OPT-009, OPT-010, OPT-011 | OPT-004 before OPT-009 | 8-12 hours | P0-P1 |
| **Week 1** | OPT-013, OPT-014, OPT-015, OPT-016, OPT-019, OPT-021, OPT-022, OPT-024 | None (parallel-safe) | 6-8 hours | P1 |
| **Week 1** | TC-001, TC-002, TC-003, TC-004 | None | 4-6 hours | P1 |
| **Week 2** | OPT-025 through OPT-042 | Core P0/P1 fixes done | 12-16 hours | P2 |
| **Week 3-4** | OPT-043 through OPT-052 | None | 4-6 hours | P3 |

---

# Expected Before/After Comparison

| Metric | Before | After (projected) | Improvement |
|--------|--------|-------------------|-------------|
| Security vulnerabilities | 3 CRITICAL, 7 HIGH, 8 MED | 0 CRITICAL, 0 HIGH, 2 MED | 16 findings resolved |
| Alarm check latency (50 parts) | ~10s+ (sequential) | ~2s (concurrent + batched) | 5x faster |
| ERP API calls per automation page | ~60 requests | ~5 requests | 12x reduction |
| Parts search latency at 100K rows | ~500ms+ (table scan) | ~5-50ms (FULLTEXT) | 10-100x faster |
| Bots page initial JS bundle | +120 KB gzipped (recharts) | 0 KB (lazy loaded) | -120 KB |
| MySQL connections (both pools) | Up to 20 (duplicate pools) | 10 (consolidated) | 50% reduction |
| Dashboard event loop blocking | Up to 25s (sync sc query) | 0s (async + cached) | Non-blocking |
| Bot log memory per request | Up to 50MB | ~500 KB max | 100x reduction |
| MFA manual enrollment | Broken (shows "undefined") | Working | Functional fix |
| Test coverage (critical paths) | 0% (MFA, auth, rate limit) | >80% | From 0 to covered |

---

# Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSP header breaks Three.js canvas | Medium | High (homepage broken) | Test CSP in report-only mode first: `Content-Security-Policy-Report-Only` |
| ERP AERO rejects page_size=100 | Low | Medium (pagination reverts) | Already proven by `erp-aero.ts` using 100 |
| FULLTEXT index creation locks production table | Medium | High (downtime during ALTER) | Run as `ALTER TABLE ... ADD FULLTEXT INDEX` during low-traffic window; InnoDB supports online DDL |
| ERP client consolidation breaks callers | Medium | High | Run full test suite; verify all `erp-aero.ts` imports are migrated |
| Next.js upgrade introduces breaking changes | Medium | High | Pin to exact version; run full test suite; compare with Next.js changelog |
| HSTS header prevents HTTP access | Low | Medium | Only add when HTTPS is confirmed for all environments |
| MSAL dependency for Graph tokens | Low | Low | `@azure/msal-node` is Microsoft's official library; well-maintained |

---

# Dependencies Between Proposals

```
OPT-004 (ERP consolidation) ──── must complete before ──── OPT-009 (shared RO fetch)
OPT-001 + OPT-002 ──── merged (same file, same fix)
OPT-003 + OPT-012 ──── both touch inventory-db.ts (sequential, not parallel)
OPT-019 + OPT-031 ──── both modify getLogTail/getBotMetrics in bot-helpers.ts (sequential)
OPT-011 ──── requires DB migration before code change
OPT-047 ──── requires schema migration (add last_used_code column)
OPT-036 ──── requires @azure/msal-node dependency addition
```

---

*This plan was generated by the optimizer agent (Claude Opus 4.6 MAX effort) from static analysis of the codebase and 4 audit reports. No production metrics were available. Latency estimates are based on code pattern analysis and published benchmarks. Dynamic testing and production profiling are recommended before and after implementation.*

Sources consulted for research:
- [Next.js Security Update December 2025](https://nextjs.org/blog/security-update-2025-12-11)
- [CVE-2025-66478 Discussion](https://github.com/vercel/next.js/discussions/86876)
- [Node.js crypto.timingSafeEqual](https://www.geeksforgeeks.org/node-js/node-js-crypto-timingsafeequal-function/)
- [Cloudflare timing-safe comparison](https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/)
- [MySQL FULLTEXT vs LIKE Performance](https://makandracards.com/makandra/12813-performance-analysis-mysqls-fulltext-indexes-like-queries)
- [Full-text Search vs LIKE](https://blog.yarsalabs.com/full-text-search-in-mysql/)
- [MySQL Full-Text Indexing Guide](https://releem.com/blog/comprehensive-guide-mysql-full-text-indexing)
