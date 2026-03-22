# Correctness Audit Report — Genthrust-XVII-LLC
**Date:** 2026-03-16
**Auditor:** review-correctness agent
**Scope:** All API routes in `app/api/`, core libs (`lib/erp-aero.ts`, `lib/erp-client.ts`, `lib/mfa.ts`, `lib/rate-limit.ts`, `lib/bot-helpers.ts`, `lib/inventory-db.ts`, `lib/db.ts`), frontend components with polling/state, and all `__tests__/` files.

---

## Executive Summary

The codebase is well-structured and defensively coded in most areas. The primary concerns are:
1. A **CRITICAL race condition** in the ERP token refresh path
2. Several **HIGH-severity missing validation** and authorization bypass issues
3. A **HIGH** unvalidated `userId` from untrusted request body used directly in privileged admin operations
4. Numerous **MEDIUM** issues including unguarded NaN pagination, inconsistent error handling, and platform-incompatible OS calls in production paths
5. **Test coverage** is good for pure utility logic but has near-zero coverage on the most security-sensitive paths (MFA, auth, admin endpoints)

---

## CRITICAL Findings

### C-1 — Race condition in `lib/erp-aero.ts` token refresh
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/erp-aero.ts`
**Lines:** 43–48, 58–60

```ts
async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken      // ← read
  if (authPromise) return authPromise
  authPromise = authenticate().finally(() => { authPromise = null })
  return authPromise
}
// ... in erpFetch on 401:
cachedToken = null                          // ← write (clears token)
return erpFetch(path, true)                 // ← retry immediately
```

**Bug:** When a 401 is received, `cachedToken` is set to `null` and `erpFetch` is called again. Between setting `cachedToken = null` and `authenticate()` completing, any concurrent request that passes the `if (cachedToken) return cachedToken` check could also enter the `authPromise` path. However, `authenticate()` itself sets `cachedToken` at line 39 — but only after the `fetch` completes. If two concurrent 401-retry calls both clear `cachedToken` and both find `authPromise === null`, two parallel `authenticate()` calls fire. The second one overwrites the first token with a potentially fresher (or identical) token, but it also means two fresh logins are issued against the ERP, which can invalidate the prior session token depending on the ERP backend's single-session enforcement.

The deeper issue is that `lib/erp-client.ts` has its own independent `cachedToken`, `tokenExpiresAt`, and `authPromise` (lines 18–20) — a completely separate caching layer from `lib/erp-aero.ts`. Both files exist in production and can run concurrently.

**Impact:** Could result in two conflicting active tokens, ERP session invalidation, or a period where all requests fail until one token is confirmed valid.

**Fix recommendation:** Use a single authoritative token manager. Ensure that after a 401, the retry goes through `getHeaders()` (which already deduplicates via `authPromise`) rather than calling `getToken()` directly after a manual null-clear.

---

## HIGH Findings

### H-1 — Admin MFA reset accepts unvalidated `userId` from request body
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/clients/mfa-reset/route.ts`
**Lines:** 13–16, 18–21

```ts
const { userId } = await request.json()
if (!userId) {
  return NextResponse.json({ error: 'userId is required' }, { status: 400 })
}
await query(`DELETE FROM mfa_factors WHERE user_id = ?`, [userId])
await query(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`, [userId])
await query(`UPDATE portal_users SET mfa_enabled = 0 WHERE id = ?`, [userId])
```

**Bug:** `userId` is taken directly from the request body with only a truthiness check. There is no validation that `userId` is a positive integer, that the target user is a `portal_users` (client) account and not an internal user, and no audit log is written for this privileged admin action. An authenticated internal user could pass any string as `userId` (e.g., `"1 OR 1=1"`) or reset MFA for a user that should not have it touched. More critically, no row is verified to exist before deletion — a silent no-op provides no feedback that the operation succeeded.

**Fix recommendation:** Parse and validate `userId` as a positive integer. Confirm the target user exists and is a `portal_users` client before mutating. Log this action to `audit_logs`.

---

### H-2 — `page` parameter produces `NaN` offset on non-numeric input in four routes
**Files:**
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/invoices/route.ts` line 16
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/sales-orders/route.ts` line 16
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/repair-orders/route.ts` line 16

```ts
const page = parseInt(params.get('page') || '1')    // no NaN guard
const offset = (page - 1) * limit                    // NaN if page=NaN
```

**Bug:** If `page=abc` is passed, `parseInt('abc')` returns `NaN`. `NaN - 1` is `NaN`. `NaN * limit` is `NaN`. MySQL `LIMIT ? OFFSET NaN` either throws or treats NaN as 0 depending on driver version — the mysql2 driver serializes NaN as 0, but this is undocumented behavior that could change. The `audit-log` route avoids this with `Math.max(1, parseInt(...) || 1)`. The other three routes lack the same defense.

**Fix recommendation:** Apply the same pattern as `audit-log/route.ts`: `Math.max(1, parseInt(params.get('page') || '1') || 1)`.

---

### H-3 — `tail` command hardcoded to a POSIX binary on a Windows-targeted deployment
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/bot-helpers.ts`
**Lines:** 97

```ts
const tail = execFileSync('tail', ['-n', String(lines), logPath], { encoding: 'utf-8', timeout: 5000 })
```

**Bug:** The `BOT_LOG_DIR` constant is `C:\\GenthrustBot\\logs` (a Windows path, line 44), and the bot services are Windows services (`sc query`). The `tail` binary does not exist by default on Windows Server. On a production Windows deployment, this call will throw `ENOENT` for every bot log request. The route returns a 500 to the client, but the error message `Failed to load bot logs` hides the root cause. Since `getLogTail` is called inside `getBotMetrics` as well (indirectly via `fs.readFileSync`), this silently zeros all bot metrics on Windows.

**Fix recommendation:** Use Node.js `fs.readFileSync` to read the entire file and extract the last N lines in-process (already done in `getBotMetrics`), or use a platform-aware approach. The `getLogTail` function already has `fs.statSync` available; replace `execFileSync('tail', ...)` with a pure-Node tail implementation.

---

### H-4 — MFA enrollment endpoint does not return the TOTP secret to the client
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/portal/mfa/enroll/route.ts`
**Line:** 61
**Related:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/components/portal/MfaEnrollment.tsx` line 36

```ts
// In enroll/route.ts:
return NextResponse.json({ qrCodeUrl })   // 'secret' is NOT returned

// In MfaEnrollment.tsx:
setManualSecret(data.secret)              // Will be undefined
```

**Bug:** The API returns `{ qrCodeUrl }` but the component tries to read `data.secret` for the "Can't scan? Enter this key manually" fallback. `data.secret` will be `undefined`, and `manualSecret` state will be set to `undefined`. The UI will render an empty `<code>` element instead of the actual base32 secret, silently breaking the manual enrollment path for users who cannot scan QR codes. The copy button will copy `undefined` as a string.

**Fix recommendation:** Either include `secret` in the enroll response (already decoupled from the encrypted value in DB — the base32 secret is generated before encryption), or remove the manual entry UI if it is not supported.

---

### H-5 — Token refresh in `lib/erp-client.ts` does not actually refresh on token expiry
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/erp-client.ts`
**Lines:** 66–78

```ts
async function getHeaders(): Promise<Record<string, string>> {
  if (!cachedToken || Date.now() >= tokenExpiresAt) {
    if (authPromise) {
      await authPromise           // ← waits, but doesn't refresh cachedToken on its own
    } else {
      authPromise = signin().finally(() => { authPromise = null })
      await authPromise
    }
  }
  return {
    Authorization: `Bearer ${cachedToken}`,  // ← may still be null if await authPromise path was taken
    ...
  }
}
```

**Bug:** When `cachedToken` is null/expired and `authPromise` is already in flight (the `if (authPromise)` branch), the code awaits the in-flight promise but does NOT re-check `cachedToken` afterward before using it. The `await authPromise` succeeds, `cachedToken` is now set by `signin()`, and the subsequent `return { Authorization: Bearer ${cachedToken} }` does work — but only because `cachedToken` is a module-level variable mutated by `signin()`. This is correct but fragile: if `signin()` throws inside `authPromise`, `cachedToken` remains null, `authPromise` is cleaned up by `.finally()`, and the code returns `Authorization: Bearer null`. The caller then gets a 401 and retries, which is handled — but the error path is silent with no logged error at the `getHeaders` level.

**Fix recommendation:** After `await authPromise`, explicitly check `if (!cachedToken) throw new Error('Authentication failed after refresh')`.

---

### H-6 — MFA challenge token: `verifyMfaChallengeToken` `parseInt` on untrusted `sub` claim
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/mfa.ts`
**Line:** 148

```ts
return {
  userId: parseInt(payload.sub),    // No validation that sub is numeric
  email: payload.email,
}
```

**Bug:** If a tampered token somehow passes the HMAC check (e.g., due to a timing oracle or key confusion), or if a developer calls this function with a manually constructed payload, `payload.sub` could be non-numeric. `parseInt('../../etc')` returns `NaN`. `NaN` passed to a SQL `WHERE user_id = ?` query causes unpredictable behavior in mysql2 (serializes as 0, potentially matching a row with id=0 or causing a type error). Additionally, `payload.email` is used without validation — if email contains SQL-injectable characters and is ever interpolated rather than parameterized, this becomes a vector.

**Fix recommendation:** After the HMAC check, validate that `payload.sub` is a positive integer string with a regex: `/^\d+$/`. Return `null` if it fails.

---

## MEDIUM Findings

### M-1 — Duplicate MySQL connection pools in `lib/db.ts` and `lib/db/index.ts`
**Files:**
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/db.ts` — uses `globalThis.rawMysqlPool`, connectionLimit 10
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/db/index.ts` — uses `globalThis.mysqlPool`, connectionLimit 10

**Bug:** Both files create a MySQL connection pool to the same database using different `globalThis` keys. Any code that imports from `@/lib/db` gets the raw pool; code that imports from `@/lib/db/index` (Drizzle) gets a second pool. In production, this creates up to 20 simultaneous connections to the database when only 10 are expected. The pools also use slightly different env variable fallback naming (`DB_HOST` vs `DATABASE_HOST`), which means if only `DATABASE_HOST` is set, the `lib/db.ts` pool will connect to `localhost` (its default) and silently fail or connect to the wrong server.

**Fix recommendation:** Consolidate to a single pool. Either have `lib/db.ts` import the pool from `lib/db/index.ts`, or pass the `lib/db.ts` pool into the Drizzle constructor.

---

### M-2 — In-memory rate limiter state is not shared across serverless instances
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/rate-limit.ts`
**Related:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/auth/verify-credentials/route.ts` lines 16–34

**Bug:** All rate limiters (MFA verify, MFA disable, chat, auth verify-credentials) use in-memory `Map` stores. In a serverless deployment (Vercel, AWS Lambda), each function invocation may run in a different container with a cold `Map`. The rate limit only applies within a single Node.js process lifetime. With enough parallel requests across instances, an attacker can exceed the intended rate limit per minute without ever hitting the cap.

`verify-credentials/route.ts` additionally re-implements the rate limiter inline with its own `Map` (not using the shared `createRateLimiter` utility), making it two separate implementations to maintain.

**Fix recommendation:** For production use, replace in-memory rate limiting with Redis-backed counters (e.g., `upstash/ratelimit`) or at minimum document that the application must run in a single persistent process. The login rate limiter is the most security-critical.

---

### M-3 — `JSON.parse(q.part_numbers)` can throw on malformed DB data
**Files:**
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/route.ts` line 57
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/[id]/route.ts` line 35
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/[id]/send/route.ts` line 71
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/export/route.ts` line 36

```ts
part_numbers: typeof q.part_numbers === 'string' ? JSON.parse(q.part_numbers) : q.part_numbers,
```

**Bug:** There is no try/catch around `JSON.parse`. If a row was inserted with a malformed `part_numbers` value (e.g., truncated JSON, a plain string), parsing throws an unhandled exception inside the `.map()` callback in the `quotes/route.ts` list endpoint. This would cause the entire list to fail with a 500 error — one corrupt row breaks all rows.

In `quotes/export/route.ts` (line 36), the same pattern is inside the `.map()` call without protection, meaning one bad row corrupts the entire CSV export.

**Fix recommendation:** Wrap `JSON.parse` in try/catch and fall back to `[]` or `[q.part_numbers]` on failure. Consider adding a safe-parse utility shared across these call sites.

---

### M-4 — Quote PATCH status update has a SQL injection risk via string interpolation
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/[id]/route.ts`
**Lines:** 68–73

```ts
const processedAt = status === 'processed' || status === 'responded' ? 'NOW()' : 'processed_at'
await query(
  `UPDATE quote_requests SET status = ?, processed_at = ${processedAt}, updated_at = NOW() WHERE id = ?`,
  [status, id]
)
```

**Bug:** `processedAt` is interpolated directly into the SQL string (not parameterized). While `status` is validated against an allowlist before this code runs, this pattern is dangerous because it bypasses the parameterization layer for the `processed_at` column assignment. If the logic above were ever refactored and the `status` validation removed or weakened, the `processedAt` variable becomes an injection point. Additionally, the string `'processed_at'` being used as a SQL identifier (a column name reference, not a value) is a code smell — it would be safer to write the two cases as separate SQL statements.

**Fix recommendation:** Replace with two explicit UPDATE queries (one for `pending` → keep `processed_at`, one for others → set `processed_at = NOW()`), both fully parameterized.

---

### M-5 — `getBotMetrics` reads entire log files into memory without size cap
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/bot-helpers.ts`
**Lines:** 132–156

```ts
content = fs.readFileSync(logPath, 'utf-8')   // No size limit
```

**Bug:** `getBotMetrics` reads the entire log file synchronously (blocking the event loop) with no size limit. If a bot's log file grows to multiple GB (common for long-running bots), this will:
1. Block the Node.js event loop for the entire read duration
2. Allocate a string equal to the file size in memory
3. Potentially crash the process with OOM if the file is very large

The function is called for all 5 bots in every `/api/internal/bots` request (line 16–21 in bots/route.ts), making it 5 synchronous full-file reads per dashboard poll.

**Fix recommendation:** Add a file size check (`fs.statSync(logPath).size`) before reading, and skip or read only the tail if the file exceeds a threshold (e.g., 10 MB). Use `getLogTail` with a line limit instead, or use the async `fs.promises.readFile` to avoid blocking the event loop.

---

### M-6 — `getNotificationFeed` can produce exponential regex matches
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/bot-helpers.ts`
**Lines:** 183–221

```ts
for (const line of lines) {
  for (const { pattern, severity } of NOTIFICATION_PATTERNS) {
    if (pattern.test(line)) {    // ← stateful RegExp, re-used across iterations
```

Several `NOTIFICATION_PATTERNS` entries use the `i` flag but not `g`. All pattern objects are module-level singletons. JavaScript `RegExp` with the `g` flag maintains `lastIndex` state. While these patterns don't use `g`, the pattern `{ pattern: /error|failed|exception/i, severity: 'error' }` applied to thousands of log lines across 5 bots could be slow on large inputs. More critically, `pattern.test()` returns `true` on the first match per line and breaks, which is correct — but the `NOTIFICATION_PATTERNS[8]` entry matches `error|failed|exception`, meaning every single log error line adds a notification. For a crashing bot producing thousands of error lines per day, this fills the notification feed with a single message type, effectively drowning out other signals.

**Fix recommendation:** Cap notifications per bot per severity (e.g., max 5 error notifications per bot in the feed). Filter today's lines before regex matching rather than after to reduce processed input.

---

### M-7 — `portal/dashboard` destructs query results without null guards — will throw on empty DB
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/portal/dashboard/route.ts`
**Lines:** 31–35

```ts
const [
  [{ activeSOs }],            // destructures first element of array
  [{ openInvoices, openBalance }],
  [{ activeROs }],
  ...
] = await Promise.all([...])
```

**Bug:** `COUNT(*)` queries always return exactly one row in MySQL, so these destructures are safe in practice. However, if any query returns an empty array (e.g., due to a driver bug, a permissions error on the table, or a future refactor), the destructuring `[{ activeSOs }]` will throw `TypeError: Cannot destructure property 'activeSOs' of undefined`. Unlike the internal dashboard which uses `safeCount()` with a `{}` fallback, the portal dashboard has no such protection. The outer try/catch will catch this and return a 500, but a caught 500 is worse UX than a graceful degradation.

**Fix recommendation:** Use `safeCount`-style wrappers, or add `|| [{ activeSOs: 0 }]` fallbacks: `const [[statsRow = { activeSOs: 0 }]] = await ...`.

---

### M-8 — `M365_GRAPH_ACCESS_TOKEN` is a static env var — will expire silently
**Files:**
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/[id]/send/route.ts` line 19
- `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/sync/route.ts` line 40

**Bug:** Microsoft Graph OAuth2 access tokens expire after 1 hour. Storing a token as a static env variable (`M365_GRAPH_ACCESS_TOKEN`) means the email send and sync features will silently fail after one hour of server uptime. There is no expiry check, no refresh logic, and no user-facing indication that Graph calls are failing until a user attempts to send a quote email and receives a 500 (or Graph returns a 401 that is not surfaced clearly).

**Fix recommendation:** Implement MSAL client credentials flow to obtain tokens on-demand with automatic refresh, or store the refresh token and implement a refresh cycle.

---

### M-9 — `inventory-alarms/check` updates watchlist even on partial ERP failure
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/inventory-alarms/check/route.ts`
**Lines:** 32–70

```ts
try {
  const liveData = await getPartLiveData(...)
  ...
} catch (err) {
  console.error(...)
  continue    // ← skips the UPDATE, preserves last_known_qty
}

// But then:
await inventoryQuery(
  `UPDATE inventory_watchlist SET last_known_qty = ?, last_checked_at = NOW() ...`,
  [currentQty, item.id]   // currentQty = 0 (from initialization)
)
```

**Bug:** On a successful ERP check with `liveData.length === 0` (meaning the part search returned no results, not the same as quantity = 0), `currentQty` remains 0 and the watchlist is updated with `last_known_qty = 0`. This would immediately trigger an alarm on the next check cycle if `previousQty > 0`, because `currentQty === 0` is treated as "depleted." An empty ERP search result (part not found in search) is conflated with "zero quantity in stock."

**Fix recommendation:** Distinguish between "ERP returned results with qty=0" (genuine depletion) and "ERP search returned no matching parts" (part not found in ERP, which is ambiguous). Add a `found` flag to track whether the part was actually seen in results versus simply not returned.

---

### M-10 — `lib/inventory-db.ts` pool not cached in `globalThis` — creates a new pool on each module reload in dev
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/inventory-db.ts`
**Lines:** 4–20

```ts
let pool: mysql.Pool | null = null   // module-level, not globalThis
export function getInventoryPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(...)
  }
  return pool
}
```

**Bug:** In Next.js development mode, modules are hot-reloaded on every change. A module-level `let pool` is re-initialized on each reload, creating a new pool and leaking the old one (connections are not closed). `lib/db.ts` and `lib/db/index.ts` both correctly use `globalThis` to survive hot reloads; the inventory pool does not.

**Fix recommendation:** Apply the same `globalThis` caching pattern:
```ts
const g = globalThis as { inventoryPool?: mysql.Pool }
g.inventoryPool ??= mysql.createPool({...})
```

---

### M-11 — `admin/create-client` does not validate email format or password strength
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/admin/create-client/route.ts`
**Lines:** 22–29

```ts
if (!email || !password || !contact_name) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
}
// No email format check, no password length/strength check
const passwordHash = await hashPassword(password)
```

**Bug:** A one-character password passes validation. An invalid email format (e.g., `"not-an-email"`) is stored in the DB. The `register/route.ts` endpoint correctly checks `password.length < 8`, but the admin endpoint used by internal staff to create client accounts does not apply the same rule. This creates an inconsistency where admin-created accounts may have weaker credentials than self-registered accounts.

**Fix recommendation:** Validate email format (regex or `z.string().email()`) and apply the same minimum password length (8 chars) as the registration endpoint.

---

## LOW Findings

### L-1 — Chat stream has no size cap on accumulated assistant response
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/components/internal/ChatPanel.tsx`
**Lines:** 65–76

```ts
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  assistantText += decoder.decode(value, { stream: true })   // unbounded concatenation
  setMessages(...)
}
```

**Bug:** `assistantText` grows without bound. While the server caps `maxOutputTokens: 2048` (chat/route.ts line 120), the client has no limit. If the server cap were ever raised or removed, a very long response would cause repeated React state updates (one per chunk) with a growing string, degrading rendering performance. On a slow connection with many chunks, this also triggers excessive re-renders.

**Fix recommendation:** This is a low-risk issue given the server-side 2048 token cap. Consider batching state updates or using a ref for accumulation.

---

### L-2 — `DashboardClient.tsx` `loadOverview` is defined inside the component but not wrapped in `useCallback`
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/components/internal/DashboardClient.tsx`
**Lines:** 33–47, 49–53

```ts
async function loadOverview() { ... }   // new function reference every render

useEffect(() => {
  loadOverview()
  const interval = setInterval(loadOverview, 60_000)
  return () => clearInterval(interval)
}, [])   // eslint exhaustive-deps would flag this
```

**Bug:** The `useEffect` has an empty dependency array `[]` which means it only runs once on mount. This is correct for the interval setup. However, `loadOverview` is redefined on every render. The interval captures the version of `loadOverview` from the first render (via closure). If state used inside `loadOverview` ever changes and matters to the fetch behavior, the stale closure would use the initial values. Currently `loadOverview` has no dependency on component state (it only calls `setLoading`, `setError`, `setData`, `setLastRefresh`), so this is not a present bug but is a latent maintenance hazard.

**Fix recommendation:** Wrap `loadOverview` in `useCallback(loadOverview, [])` and add it to the `useEffect` dependency array to make the intent explicit.

---

### L-3 — `getGreeting` is called at render time, not on refresh — will show stale greeting
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/components/internal/DashboardClient.tsx`
**Line:** 69

```ts
const greeting = getGreeting()   // evaluated at render time
```

**Bug:** `getGreeting()` reads `new Date().getHours()`. With a 60-second auto-refresh triggering `loadOverview()` (which calls `setLoading(true)` → re-renders), the greeting will update every 60 seconds. This is acceptable behavior but may surprise users who open the dashboard at 11:59 PM and see "Good evening" change to "Good morning" mid-session. More importantly, if React batches renders and the component does not re-render between refreshes, the greeting may not update even after midnight. This is a cosmetic low issue.

---

### L-4 — Export CSV does not escape newlines in field values
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/internal/quotes/export/route.ts`
**Lines:** 39–45

```ts
`"${(q.sender_name || '').replace(/"/g, '""')}"`,
`"${(q.subject || '').replace(/"/g, '""')}"`,
```

**Bug:** The CSV escaping replaces double-quotes but does not replace or escape newline characters (`\n`, `\r\n`) within field values. If `subject` or `sender_name` contains a newline (e.g., from a multiline email subject), the CSV row will be split across two lines, corrupting the file structure for any downstream parser that doesn't handle RFC-4180 multiline fields.

**Fix recommendation:** Also replace `\r` and `\n` with a space or `\\n` before inserting into CSV fields.

---

### L-5 — `verify-credentials` rate limiter resets on first legitimate request rather than on success
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/app/api/auth/verify-credentials/route.ts`
**Lines:** 22–34

```ts
function isRateLimited(ip: string): boolean {
  ...
  entry.count++         // increments on EVERY non-rate-limited call
  return false
}
```

**Bug:** The login rate limiter counts every request (successful or failed) toward the limit of 5 per 60 seconds. A legitimate user who logs in successfully 5 times within a minute will be locked out. This is atypical; most rate limiters for login endpoints only count failed attempts. The MFA verify/disable limiters correctly use `check()` + `record()` on failure only + `reset()` on success. The login endpoint does not follow this pattern and uses a cruder implementation.

**Fix recommendation:** Only increment the counter on failed login attempts. Reset on success, consistent with how `mfa-verify` and `mfa-disable` work.

---

### L-6 — Hardcoded Windows path in `lib/bot-helpers.ts` will silently fail in non-Windows environments
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/lib/bot-helpers.ts`
**Line:** 44

```ts
const BOT_LOG_DIR = 'C:\\GenthrustBot\\logs'
```

**Bug:** This is a hard-coded absolute path. If the application runs in a Linux container (e.g., during CI, Docker, or if a future deployment uses Linux), all bot log reads will fail silently. The `getLogTail` function returns `{ content: 'Log file not found: C:\\...', sizeBytes: 0 }` which is at least a graceful degradation, but the `getBotMetrics` function catches the `fs.readFileSync` error and returns zeroed metrics without logging a warning.

**Fix recommendation:** Expose as an environment variable: `const BOT_LOG_DIR = process.env.BOT_LOG_DIR || 'C:\\GenthrustBot\\logs'`.

---

## Test Coverage Gaps

### TG-1 — CRITICAL: No tests for `lib/mfa.ts`
The following functions have zero test coverage:
- `encryptSecret` / `decryptSecret` — AES-256-GCM encryption/decryption of TOTP secrets
- `generateTotpSecret` / `verifyTotpCode` — core MFA correctness
- `createMfaChallengeToken` / `verifyMfaChallengeToken` — JWT-like token creation/verification

**What should be tested:**
- `verifyTotpCode` with a valid code, an expired code (window=-2), and an invalid code
- `verifyMfaChallengeToken` with a valid token, expired token, wrong secret, malformed token, non-numeric sub
- `encryptSecret`/`decryptSecret` round-trip
- `decryptSecret` with tampered `authTag` should throw

**Why critical:** MFA is the second authentication factor. Bugs here directly break security guarantees.

---

### TG-2 — CRITICAL: No tests for `auth.ts` (NextAuth credentials authorize logic)
The credential authorization flow handles:
- Mode A (email+password login)
- Mode B (MFA token + TOTP code)
- Recovery code fallback in Mode B
- Domain block (`@genthrust.net` cannot use client login)
- `mfa_enabled=1` blocks Mode A

**What should be tested:**
- Mode A succeeds with correct credentials
- Mode A fails with wrong password
- Mode A is blocked for `@genthrust.net` emails
- Mode A is blocked when `mfa_enabled=1`
- Mode B accepts valid TOTP code
- Mode B accepts valid recovery code and marks it used
- Mode B rejects expired MFA challenge token
- Mode B rejects invalid TOTP code

**Why critical:** Auth bypass is the highest-impact bug category.

---

### TG-3 — HIGH: No tests for rate limiter behavior
`lib/rate-limit.ts` has no test coverage. The rate limiter is used for login, MFA verify, MFA disable, and AI chat endpoints.

**What should be tested:**
- `check()` returns `allowed: true` before threshold
- `check()` returns `allowed: false` at and above threshold
- `record()` increments counter
- `reset()` clears the counter allowing requests again
- Window expiry: after `windowMs` elapses, a new window starts
- `retryAfterSeconds` is correct (positive, at least 1)
- Concurrent calls to `check()` and `record()` (within JS single-threaded model — not a race, but worth testing the increment logic)

---

### TG-4 — HIGH: No tests for `lib/erp-aero.ts` or `lib/erp-client.ts`
No test coverage for ERP authentication, token caching, 401 retry logic, pagination via `fetchAllPages`, or malformed ERP response handling.

**What should be tested (with mocked `fetch`):**
- `getToken()` deduplicates concurrent auth requests to a single `authenticate()` call
- 401 response triggers re-authentication and retry
- `fetchAllPages` stops when `items.length === 0`
- Malformed JSON in ERP response (missing `data.token`) throws a descriptive error

---

### TG-5 — MEDIUM: No tests for `lib/bot-helpers.ts`
- `queryServiceStatus` — `sc` command parsing for RUNNING/STOPPED/UNKNOWN
- `getBotMetrics` — regex metric counting, today-only filtering
- `getNotificationFeed` — correct timestamp extraction, sort order, limit enforcement
- `getLogTail` — line count limiting

---

### TG-6 — MEDIUM: Existing tests give false confidence on `quote-api-logic.test.ts`
**File:** `/mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC/__tests__/quote-api-logic.test.ts`

The test file extracts "helper" functions that mirror route logic but tests them in isolation. These tests do NOT exercise:
- The actual route handler (authentication, DB interaction, error propagation)
- The SQL query injection behavior of the `PATCH` endpoint (see M-4)
- The `processedAt` SQL interpolation path
- The JSON.parse failure path (see M-3 — the `parsePartNumbers` test helper adds its own try/catch, but the route code does not have one)

The test for `parsePartNumbers` at line 144–147 tests a helper that is more defensive than the actual route implementation. The test passes, but the route can still throw.

---

### TG-7 — LOW: `schema.test.ts` only verifies column existence, not constraints
The schema tests verify that Drizzle columns are defined, but do not test:
- NOT NULL constraints are enforced
- Unique indexes (e.g., duplicate email in `portal_users`)
- Foreign key relationships between tables
- That `mfa_factors.status` is properly constrained to `pending/verified`

---

## Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| C-1 | CRITICAL | `lib/erp-aero.ts` | Token refresh race condition; dual token manager conflict with `lib/erp-client.ts` |
| H-1 | HIGH | `api/internal/clients/mfa-reset/route.ts` | Unvalidated `userId` from request body in privileged admin operation |
| H-2 | HIGH | `api/internal/invoices,sales-orders,repair-orders/route.ts` | `parseInt(page)` NaN not guarded → NaN offset in SQL |
| H-3 | HIGH | `lib/bot-helpers.ts:97` | `tail` binary hardcoded; not available on Windows production deployment |
| H-4 | HIGH | `api/portal/mfa/enroll/route.ts` + `MfaEnrollment.tsx` | `secret` not returned from enroll API; manual entry UI shows `undefined` |
| H-5 | HIGH | `lib/erp-client.ts:74` | After awaiting in-flight `authPromise`, `cachedToken` can still be null on failure |
| H-6 | HIGH | `lib/mfa.ts:148` | `parseInt(payload.sub)` without validation; NaN passed to SQL on invalid token |
| M-1 | MEDIUM | `lib/db.ts` + `lib/db/index.ts` | Duplicate connection pools to same DB; inconsistent env var fallbacks |
| M-2 | MEDIUM | `lib/rate-limit.ts` | In-memory rate limiter not effective in multi-instance/serverless deployments |
| M-3 | MEDIUM | `api/internal/quotes/*.ts` | `JSON.parse(q.part_numbers)` can throw; one corrupt row breaks entire list |
| M-4 | MEDIUM | `api/internal/quotes/[id]/route.ts:71` | `processedAt` string interpolated into SQL (not parameterized) |
| M-5 | MEDIUM | `lib/bot-helpers.ts:142` | `fs.readFileSync` of full log file (no size cap); blocks event loop |
| M-6 | MEDIUM | `lib/bot-helpers.ts:199` | Error-pattern regex matches flood notification feed from crashing bots |
| M-7 | MEDIUM | `api/portal/dashboard/route.ts:31` | Destructuring first element of COUNT results — throws on empty array |
| M-8 | MEDIUM | `api/internal/quotes/*/route.ts` | `M365_GRAPH_ACCESS_TOKEN` static env var will expire silently after 1 hour |
| M-9 | MEDIUM | `api/internal/inventory-alarms/check/route.ts:26` | Zero search results from ERP conflated with zero quantity → spurious alarms |
| M-10 | MEDIUM | `lib/inventory-db.ts:4` | Pool not cached in `globalThis`; leaked on hot reload in dev |
| M-11 | MEDIUM | `api/admin/create-client/route.ts:22` | No email format or minimum password length validation |
| L-1 | LOW | `components/internal/ChatPanel.tsx:68` | No size cap on accumulated stream response string |
| L-2 | LOW | `components/internal/DashboardClient.tsx:33` | `loadOverview` not in `useCallback`; stale closure risk on future refactors |
| L-3 | LOW | `components/internal/DashboardClient.tsx:69` | `getGreeting()` called at render time — cosmetic stale-greeting edge case |
| L-4 | LOW | `api/internal/quotes/export/route.ts:39` | CSV does not escape newlines in field values |
| L-5 | LOW | `api/auth/verify-credentials/route.ts:32` | Rate limiter counts successful logins; legitimate users can be locked out |
| L-6 | LOW | `lib/bot-helpers.ts:44` | `BOT_LOG_DIR` hardcoded Windows path — fails silently on Linux |
| TG-1 | CRITICAL gap | `lib/mfa.ts` | Zero test coverage for MFA encryption, TOTP verification, challenge tokens |
| TG-2 | CRITICAL gap | `auth.ts` | Zero test coverage for NextAuth credential authorize logic |
| TG-3 | HIGH gap | `lib/rate-limit.ts` | Zero test coverage for rate limiter |
| TG-4 | HIGH gap | `lib/erp-aero.ts` / `lib/erp-client.ts` | Zero test coverage for ERP client |
| TG-5 | MEDIUM gap | `lib/bot-helpers.ts` | Zero test coverage for bot helpers |
| TG-6 | MEDIUM gap | `__tests__/quote-api-logic.test.ts` | Tests exercise more-defensive helper copies, not actual route code |
| TG-7 | LOW gap | `__tests__/schema.test.ts` | Schema tests only check column existence, not constraints |

---

*Report generated by review-correctness agent. Read-only analysis. No code was modified.*
