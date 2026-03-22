# Genthrust Website — Problems Found & Resolved

**Date:** 2026-03-14
**Scope:** Runtime 500 errors, auth vulnerabilities, observability gaps

---

## 1. mysql2 Webpack Bundling (CRITICAL)

**Symptoms:** Every authenticated API route returned HTTP 500. Errors like `Cannot find module 'net'`, `Module not found: 'tls'`, `Module not found: 'dns'` in production logs.

**Root cause:** Next.js webpack bundled `mysql2` into client/server chunks, stripping Node.js-only native modules (`net`, `tls`, `dns`) that mysql2 depends on. All database queries failed at runtime.

**Fix:** Added `mysql2` to `serverComponentsExternalPackages` in `next.config.js` so Next.js treats it as a Node-native dependency and skips webpack bundling:

```js
experimental: {
  serverComponentsExternalPackages: ['mysql2'],
}
```

**File:** `next.config.js` (line 4)

---

## 2. @genthrust.net Credentials Bypass

**Symptoms:** Internal employees with `@genthrust.net` email addresses could authenticate via the client credentials login flow (`/login`) instead of being routed through Microsoft Entra SSO (`/signin`).

**Root cause:** The credentials provider `authorize()` function did not check the email domain before attempting password verification.

**Fix:** Added domain checks in `auth.ts`:
- **Mode A (email + password):** Block `@genthrust.net` emails at line 138 before password verification.
- **Mode B (MFA token + TOTP):** Block `@genthrust.net` emails at lines 63-69 during the MFA challenge flow.

**File:** `auth.ts` (lines 63-69, 136-138)

---

## 3. JWT/Session Callback Crashes

**Symptoms:** Unhandled exceptions in the NextAuth `jwt()` or `session()` callbacks would crash the entire auth flow, producing 500 errors on any page load.

**Root cause:** No error handling around token/session property assignments. A single undefined property access or type mismatch would propagate as an unhandled exception.

**Fix:** Wrapped both `jwt()` and `session()` callbacks in try-catch blocks in `auth.config.ts`. Errors are logged with `console.error('[auth] ...')` and the token/session is returned as-is to prevent full auth failure.

**File:** `auth.config.ts` (lines 67-88 for jwt, lines 90-107 for session)

---

## 4. Silent Catch Blocks in API Routes

**Symptoms:** API routes returned `{ "error": "Failed to ..." }` with HTTP 500, but server logs showed only `[Object object]` or no useful information, making debugging impossible.

**Root cause:** Catch blocks logged raw error objects (`console.error('...', error)`) which Node.js serializes as `[Object object]` for Error instances.

**Fix:** Updated all catch blocks to extract structured error info:

```ts
console.error('...', error instanceof Error ? { message: error.message, stack: error.stack } : error)
```

**Files:**
- `app/api/internal/inventory-intelligence/search/route.ts` (line 55)
- `app/api/internal/bots/route.ts` (line 28)
- `app/api/internal/automation/route.ts` (line 40)
- `app/api/internal/inventory-intelligence/parse-pdf/route.ts` (line 57)

---

## 5. No Diagnostics Endpoint

**Symptoms:** No way to verify database connectivity or debug connection issues from the running application. Had to SSH into the server and manually test MySQL connections.

**Root cause:** No health/diagnostics route existed.

**Fix:** Created `/api/internal/diagnostics` route that tests both database pools (main DB on port 3307, inventory DB on port 3306), lists inventory tables, and returns connection status. Protected behind internal-role auth check.

**File:** `app/api/internal/diagnostics/route.ts` (new file)

---

## 6. No Error Logging in inventoryQuery

**Symptoms:** Database query failures in the inventory DB pool were silently swallowed or produced unhelpful stack traces.

**Root cause:** `inventoryQuery()` in `lib/inventory-db.ts` had no logging before rethrowing errors.

**Fix:** Added `console.error('Inventory DB query error:', error)` in the catch block before rethrowing.

**File:** `lib/inventory-db.ts` (lines 30-33)

---

## 7. Python Bot Pool Recycling (GenthrustBot)

**Symptoms:** Bot processes that ran for extended periods would fail with MySQL "server has gone away" errors when the connection pool held stale connections past MySQL's `wait_timeout`.

**Root cause:** Default SQLAlchemy pool settings don't recycle connections, so connections that exceed MySQL's idle timeout (typically 8 hours) become invalid.

**Fix:** Configured pool recycling in `db_connection.py`:
- `pool_recycle: 3600` — recycle connections after 1 hour
- `pool_size: 10` — explicit pool size

**File:** `GenthrustBot/db_connection.py`

---

## 8. OneDrive Sync Bot Filename

**Symptoms:** Sync bot failed to download the inventory spreadsheet from OneDrive because the file path was hardcoded incorrectly.

**Root cause:** Hardcoded OneDrive path didn't match the actual filename, and special characters weren't URL-encoded.

**Fix:** Made the path configurable via `SYNC_FILE_PATH` environment variable in `sync_bot.py`, with proper URL encoding of the filename component.

**File:** `GenthrustBot/sync_bot.py`

---

## 9. @types/pdf-parse Conflict

**Symptoms:** TypeScript compilation errors when using pdf-parse v2 API — type definitions didn't match the v2 class-based API (`new PDFParse({ data })`).

**Root cause:** `@types/pdf-parse` provides types for pdf-parse v1 (callback-based API), which conflicts with the v2 API.

**Fix:** Removed `@types/pdf-parse` from devDependencies.

**File:** `package.json`

---

## Summary

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | mysql2 webpack bundling | Critical | Bundling |
| 2 | @genthrust.net credentials bypass | High | Auth/Security |
| 3 | JWT/Session callback crashes | High | Auth |
| 4 | Silent catch blocks | Medium | Observability |
| 5 | No diagnostics endpoint | Medium | Observability |
| 6 | No inventoryQuery error logging | Medium | Observability |
| 7 | Python bot pool recycling | Medium | Database |
| 8 | OneDrive sync filename | Medium | Configuration |
| 9 | @types/pdf-parse conflict | Low | TypeScript |
