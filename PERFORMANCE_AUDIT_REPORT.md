# Genthrust-XVII-LLC — Performance Audit Report

**Audit Date**: 2026-03-16
**Auditor**: review-performance agent
**Scope**: Database queries, API routes, frontend bundle, React performance, animations, SSR, images/assets

---

## Executive Summary

The application is well-structured overall, with good use of `Promise.all` for parallel DB queries and proper connection pooling on the main database. The most impactful issues are:

1. **CRITICAL** — Sequential N+1 ERP API calls in the watchlist alarm checker (one HTTP request per watched part)
2. **HIGH** — `fetchAllPages` is called three times independently for `v1/ro/list` in a single user request — 60 sequential HTTP pages fetched in parallel waste 2–3× the API quota
3. **HIGH** — Recharts and its full dependency tree is statically imported in the bots page with no dynamic split
4. **HIGH** — `inventory-db.ts` pool is not anchored to `globalThis`, so it can be recreated on every cold module re-evaluation in the Next.js serverless runtime
5. **HIGH** — Search API uses five `LIKE '%…%'` predicates with no full-text index, causing sequential table scans
6. **MEDIUM** — `useReducedMotion` hook exists but is **not consumed anywhere** in the component tree
7. **MEDIUM** — Detail-view API routes use `SELECT *` on tables with many columns, over-fetching on every drawer open
8. **MEDIUM** — `DataTable` performs client-side sort on the full dataset in-memory with no virtualization
9. **LOW** — Rate-limiter and search-attempts maps are unbounded in-process memory
10. **LOW** — `MagneticButton` schedules `requestAnimationFrame` loops on every `mousemove` on the public landing page

---

## CRITICAL Issues

### C1 — N+1 HTTP Calls in Watchlist Alarm Checker

**File**: `app/api/internal/inventory-alarms/check/route.ts`, lines 22–71
**Impact**: One sequential ERP API call per watchlist item. If the watchlist has 50 parts, the route makes 50 serial HTTP requests before returning, plus 50 individual `UPDATE` queries.

```
for (const item of watchlist) {
  const liveData = await getPartLiveData(item.part_number, item.condition_code)  // HTTP per item
  await inventoryQuery('UPDATE inventory_watchlist SET ...', ...)                 // DB write per item
}
```

**Performance impact**: At 50 watched parts, with ~200 ms per ERP call, this route takes **10+ seconds** minimum. Each watched part also generates a round-trip to the ERP token cache logic.

**Suggestion**:
- Batch `getPartLiveData` calls: issue all ERP requests in parallel with `Promise.allSettled` (respecting a concurrency limiter, e.g. 5–10 at a time using a semaphore).
- Batch the DB updates: collect all `(currentQty, id)` pairs and execute a single `INSERT ... ON DUPLICATE KEY UPDATE` or multi-row `CASE WHEN` update instead of N individual `UPDATE` statements.

---

## HIGH Issues

### H1 — Triple-Fetching `v1/ro/list` Pages Per Request

**File**: `lib/erp-client.ts`, lines 154, 184, 214, 288
**Impact**: `getActiveRepairOrders`, `getNet30PaymentDates`, and `getFollowupROs` each independently call `fetchAllPages('v1/ro/list')`. When the `/api/internal/automation` route calls all four ERP functions in `Promise.all`, three of them each serially fetch up to 20 pages of RO data (25 items/page = up to 500 items each). This results in up to **60 sequential HTTP requests** where 20 would suffice.

```ts
// automation/route.ts — three callers each walk the same paginated list
const [net30, followups, purchaseOrders, repairOrders] = await Promise.all([
  getNet30PaymentDates(),    // fetchAllPages('v1/ro/list')
  getFollowupROs(),          // fetchAllPages('v1/ro/list')  ← duplicate
  getOpenPurchaseOrders(),
  getActiveRepairOrders(50), // fetchAllPages('v1/ro/list')  ← duplicate
])
```

**Performance impact**: 2–3× the actual ERP API load per automation page load; 3× the latency-compounded wait if rate limits are hit.

**Suggestion**: Fetch `v1/ro/list` once per request, then filter in memory for each consumer. Extract a shared `getAllRepairOrders()` helper and pass the result to `getNet30PaymentDates`, `getFollowupROs`, and `getActiveRepairOrders` as an argument, so callers share one fetch result.

---

### H2 — `fetchAllPages` Uses page_size=25 (Too Small)

**File**: `lib/erp-client.ts`, line 131
**Impact**: Each call fetches 25 items per page and iterates up to 20 pages, producing up to 20 sequential HTTP round-trips to load 500 items. The ERP API likely supports larger page sizes.

```ts
page_size: '25',  // 20 pages needed for 500 items
```

**Suggestion**: Increase `page_size` to `100` or `200` (validate against ERP API limits). At `page_size=100` and a 500-item dataset, the same data loads in 5 requests instead of 20 — a 4× reduction in serial HTTP latency.

---

### H3 — `inventory-db.ts` Pool Not Anchored to `globalThis`

**File**: `lib/inventory-db.ts`, lines 3–20
**Impact**: Unlike `lib/db.ts` which correctly uses `globalThis.rawMysqlPool ??= ...`, the inventory pool uses a plain module-level `let pool`. In Next.js serverless environments, module re-evaluation on cold start or hot reload can create multiple pools, leaking connections up to `connectionLimit` each time.

```ts
// db.ts — correct pattern (anchored to globalThis)
globalForRawDb.rawMysqlPool ??= mysql.createPool({ ... })

// inventory-db.ts — wrong pattern (not anchored)
let pool: mysql.Pool | null = null
export function getInventoryPool(): mysql.Pool {
  if (!pool) { pool = mysql.createPool({ ... }) }
  return pool
}
```

**Performance impact**: Connection pool exhaustion under load or after hot reload; connection count multiplied by number of module re-evaluations.

**Suggestion**: Mirror the `db.ts` pattern exactly:
```ts
const globalForInventory = globalThis as unknown as { inventoryPool: mysql.Pool | undefined }
globalForInventory.inventoryPool ??= mysql.createPool({ ... })
```

---

### H4 — Search API Uses Five `LIKE '%query%'` with No Full-Text Index

**File**: `app/api/search/route.ts`, lines 39–65
**Impact**: The public parts search queries five columns with leading-wildcard `LIKE '%…%'` patterns on the `parts` table. Leading-wildcard `LIKE` **cannot use a B-tree index** and forces a full table scan on every search. At 10,000+ synced parts this is slow; at 100,000+ it becomes a production outage risk.

```sql
WHERE product_name LIKE ?
   OR description LIKE ?
   OR mfr_part_no LIKE ?
   OR nsn_number LIKE ?
   OR cage_code LIKE ?
```

The comment in the code acknowledges full-text requires 3+ characters, but a `FULLTEXT` index on `(product_name, description, mfr_part_no, nsn_number, cage_code)` would be 10–100× faster for the typical search query length (part numbers are ≥4 characters).

**Suggestion**: Add a MySQL `FULLTEXT` index on `parts(product_name, description, mfr_part_no, nsn_number, cage_code)` and switch the query to `MATCH(...) AGAINST(? IN BOOLEAN MODE)` for queries ≥3 characters, falling back to `LIKE` only for 1–2 character inputs. Also add a non-fulltext index on `parts(product_name)` for exact-match lookups.

---

### H5 — Recharts Statically Imported on Bots Page (No Dynamic Split)

**File**: `app/internal/bots/page.tsx`, lines 12–16
**Impact**: `recharts` (~400 KB minified, ~120 KB gzipped) is imported statically at the top of the bots page. This means the entire Recharts bundle is included in the initial JS chunk for the bots route, blocking interactivity even though the charts are only visible after the bot fleet tab loads.

```ts
import { LineChart, Line } from 'recharts'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
```

**Performance impact**: ~120 KB added to the initial JS parse budget on first load of `/internal/bots`.

**Suggestion**: Replace with `next/dynamic` imports for chart components with `ssr: false`. Wrap chart sections in dynamically imported wrappers so Recharts loads only after the user's tab is rendered.

---

## MEDIUM Issues

### M1 — `useReducedMotion` Hook Exists But Is Never Consumed

**File**: `hooks/useReducedMotion.ts`
**Components with animations**: `HeroIntro.tsx`, `InstrumentCluster.tsx`, `FeaturedInventory.tsx`, `ParticleVertexAircraft/index.tsx`, `MagneticButton.tsx`, `DashboardClient.tsx`, and all Framer Motion usages
**Impact**: The hook was created but never imported by any component. Users with `prefers-reduced-motion: reduce` set (often for vestibular disorders or low-power mode) receive the full 35,000-particle WebGL animation, continuous Framer Motion sequences, and the `TelemetryTicker` interval — all of which should be suppressed.

**Performance impact**: Accessibility compliance failure; also represents GPU/CPU waste for users who have explicitly requested no motion.

**Suggestion**: Import `useReducedMotion` in `HeroIntro`, `ParticleVertexAircraft/index.tsx`, `MagneticButton`, and `InstrumentCluster`. Pass a `reduceMotion` flag to disable: the Three.js canvas entirely (render a static logo instead), Framer Motion `transition` durations set to 0, and the `TelemetryTicker` interval stopped.

---

### M2 — Detail View API Routes Use `SELECT *`

**Files**:
- `app/api/internal/repair-orders/[id]/route.ts`, lines 18–29
- `app/api/internal/invoices/[id]/route.ts`, lines 18–29
- `app/api/internal/sales-orders/[id]/route.ts` (same pattern)
- `app/api/internal/quotes/[id]/route.ts`, line 21
- `app/api/mcp/route.ts`, lines 292–393

**Impact**: `SELECT *` fetches every column including potentially large `TEXT`/`LONGTEXT` fields (e.g. `full_description`, `body` on quotes). The `repair_orders`, `sales_orders`, and `invoice` tables likely contain ERP sync metadata columns irrelevant to the UI (20+ columns). Over-fetching increases serialization overhead and network payload for every drawer open.

**Suggestion**: Replace with explicit column lists matching what the `DrawerMetaGrid` and `DrawerLineItems` components actually render. For line item tables, the UI renders at most 10 fields — there is no reason to fetch all columns from potentially wide line-item tables.

---

### M3 — `DataTable` Client-Side Sort Has No Virtualization

**File**: `components/internal/DataTable.tsx`, lines 40–52
**Impact**: The generic `DataTable` component sorts its entire `data` prop in-memory on every sort key/direction change using `useMemo`. The ERP page passes up to `limit=200` rows at a time. While `useMemo` prevents re-sorts on unrelated renders, sorting 200 rows of objects with multiple `localeCompare` calls is not free, and there is no row virtualization — all 200 rows are rendered as DOM nodes simultaneously.

```ts
const sorted = useMemo(() => {
  if (!sortKey) return data
  return [...data].sort((a, b) => { ... String(av).localeCompare(String(bv)) ... })
}, [data, sortKey, sortDir])
```

**Suggestion**: For any table that can receive >50 rows, consider adding a virtualized list (e.g. `@tanstack/react-virtual`). The `LocalDataTable` in `app/internal/erp/page.tsx` already does server-side pagination at 25 rows, which mitigates this for the ERP page — but the generic `DataTable` used elsewhere has no such floor. Add a guard: if `data.length > 100`, warn in development, and consider moving sort to the server.

---

### M4 — `status-overview` Route Calls `getAllBotStatuses()` Synchronously in the Request Path

**File**: `app/api/internal/status-overview/route.ts`, lines 63–72
**Impact**: `getAllBotStatuses()` calls `execFileSync('sc', ['query', serviceName], { timeout: 5000 })` for each of 5 Windows services sequentially. This is a synchronous subprocess spawn inside an async API route — it blocks the Node.js event loop during the 5-second timeout window if Windows services are unavailable. Five service checks × 5s timeout = up to 25 seconds of potential event loop blocking.

```ts
const statuses = getAllBotStatuses()  // 5x execFileSync calls, each up to 5s timeout
```

**Performance impact**: Under a non-Windows deployment (Linux/WSL), all 5 calls fail and return `UNKNOWN` after the 5s timeout each, making the dashboard status endpoint take up to 25 seconds before responding.

**Suggestion**:
1. Replace `execFileSync` with `execFile` (async callback) or `execFile` wrapped in a Promise.
2. Run all 5 service checks in parallel (currently sequential via `Array.map` but each is synchronous).
3. Move bot status to a background job with a short in-memory cache (30s TTL) — there is no need to re-check Windows service status on every dashboard refresh.

---

### M5 — `getBotMetrics` and `getNotificationFeed` Read Full Log Files Into Memory

**File**: `lib/bot-helpers.ts`, lines 132–156, 183–220
**Impact**: `getBotMetrics` calls `fs.readFileSync(logPath, 'utf-8')` for each bot's log file, loading the entire log file into memory to filter only today's lines. If a bot log grows to 10 MB over time, 5 bots = up to 50 MB allocated per `/api/internal/bots` request. `getNotificationFeed` does the same: reads all 5 log files entirely.

```ts
content = fs.readFileSync(logPath, 'utf-8')  // Entire file, no streaming
const todayLines = content.split('\n').filter(line => line.includes(today))
```

**Suggestion**: Use `tail` (already done in `getLogTail`) via `execFileSync('tail', ['-n', '500', logPath])` to read only the last N lines rather than the entire file. Since today's log lines are appended, the last 500–1000 lines are sufficient for daily metrics, capping memory per call at ~50–100 KB regardless of log file size.

---

### M6 — `inventory-alarms/check` Issues One DB Write Per Watchlist Item

**File**: `app/api/internal/inventory-alarms/check/route.ts`, lines 64–70
**Impact**: After checking each part's quantity, the route issues a separate `UPDATE inventory_watchlist SET last_known_qty=? WHERE id=?` for every item regardless of whether the quantity changed.

**Suggestion**: Collect all `(currentQty, id)` pairs in an array and execute a single bulk update using `INSERT INTO ... ON DUPLICATE KEY UPDATE` or a `CASE WHEN` expression. For the alarm `INSERT`, batch triggered alarms into a single multi-row insert.

---

### M7 — `DashboardClient` Polls `/api/internal/status-overview` Every 60 Seconds

**File**: `components/internal/DashboardClient.tsx`, lines 49–53
**Impact**: The 60-second interval is reasonable, but the `loadOverview` function is defined inside the component without `useCallback`, meaning it is recreated on every render. The `useEffect` that sets up the interval has `[]` as dependency, so it captures the first render's `loadOverview` function — this is correct behavior, but the closure composition is fragile. More importantly, the poll fires even when the browser tab is hidden (user navigated away), wasting server resources.

**Suggestion**: Add a `document.visibilitychange` listener to pause polling when the tab is hidden and resume when it becomes visible. Also memoize `loadOverview` with `useCallback`.

---

## LOW Issues

### L1 — In-Memory Rate Limiter Maps Are Unbounded

**Files**:
- `app/api/search/route.ts`, line 6: `const searchAttempts = new Map<...>()`
- `lib/rate-limit.ts`, line 35: `const store = new Map<...>()`

**Impact**: Both maps grow indefinitely as new IPs or user IDs are added. Expired entries are lazily evicted only when a specific key is re-checked. Under sustained varied-IP traffic (e.g. a bot sweep), `searchAttempts` can accumulate thousands of stale entries never cleaned up.

**Suggestion**: Add a periodic sweep (e.g. `setInterval` on the module, or evict expired entries on every check). Alternatively, cap the map to a maximum size and evict the oldest entries using an LRU structure.

---

### L2 — `MagneticButton` Runs a `requestAnimationFrame` Loop on the Public Landing Page

**File**: `components/ui/MagneticButton.tsx`, lines 48–59
**Impact**: The `lerp` function schedules itself with `requestAnimationFrame` on every `mousemove` event and continues until the position delta is < 0.1. With two `MagneticButton` components on the hero (`SearchInventory` and `RequestQuote`), this adds continuous rAF work competing with the Three.js 35,000-particle render loop.

The rAF loop uses `setPosition(...)` which triggers a React re-render on every frame, not just a CSS transform — this means React reconciles the button subtree at 60 fps during mouse movement.

**Suggestion**: Replace `setPosition` with a direct `ref` to the DOM element and apply `element.style.transform = ...` directly, bypassing React state entirely. This eliminates the React reconciliation cost at 60 fps.

---

### L3 — `AircraftParticles` Re-reads Image and Rebuilds Geometry on Every `imagePath`/`totalParticles` Change

**File**: `components/ParticleVertexAircraft/AircraftParticles.tsx`, lines 93–168
**Impact**: `useLogoPoints` creates an `<img>` element, draws it to a canvas, and samples all pixels on every render where `imagePath` or `totalParticles` changes. The result is stored in state as 35,000 `PixelPoint` objects (each with a `THREE.Vector3` and `THREE.Color`), creating substantial GC pressure. Since both dependencies are stable constants (`'/GenLogoNoBackground.png'` and `35000`), this only runs once — but the allocation of 35,000 objects on mount is unavoidable with the current approach.

**Suggestion**: This is acceptable as a one-time initialization cost. However, consider caching the Float32Arrays (not the PixelPoint objects) in a module-level variable so that if the component unmounts and remounts (e.g. navigation back), the image is not re-decoded.

---

### L4 — `TelemetryTicker` Uses `setTimeout` Inside `setInterval` (Nested Timer)

**File**: `components/Hero/InstrumentCluster.tsx`, lines 165–173
**Impact**: The ticker uses `setInterval` → `setVisible(false)` → `setTimeout(..., 300)` → `setIndex(...)`. This nests timers and creates two state updates per tick cycle, causing two React re-renders per 3.5 seconds. Minor, but unnecessary.

**Suggestion**: Replace the nested timers with a single `setInterval` and CSS opacity transition, or use Framer Motion's `AnimatePresence` exit animation (already imported) without the manual `setTimeout`.

---

### L5 — `AnimatedCounter` Fires `requestAnimationFrame` Loop for Each Counter on Dashboard

**File**: `components/ui/AnimatedCounter.tsx`, lines 31–48
**File**: `components/internal/StatusOverviewGrid.tsx` (renders ~10 counters)
**Impact**: The `StatusOverviewGrid` renders 10+ `AnimatedCounter` instances simultaneously (one per metric). Each launches its own independent `requestAnimationFrame` loop for 600 ms. While this is brief, it means 10 concurrent rAF loops all calling `setCount(...)` at 60 fps for the first second after the dashboard loads.

**Suggestion**: Share a single rAF loop using a subscription model (or use Framer Motion's `useMotionValue` + `animate()` which internally batches), so all counters animate under one rAF tick.

---

### L6 — No HTTP Caching Headers on Internal API Responses

**All files**: `app/api/internal/**`
**Impact**: All internal API routes return `force-dynamic` with no `Cache-Control` headers. While most of these routes serve real-time data and should not be publicly cached, setting explicit `Cache-Control: no-store, private` would prevent any upstream proxy (Vercel Edge, CloudFront, Nginx) from accidentally caching authenticated responses.

**Suggestion**: Add `Cache-Control: no-store, private` to all authenticated API responses:
```ts
return NextResponse.json(data, {
  headers: { 'Cache-Control': 'no-store, private' }
})
```

---

### L7 — `erp-aero.ts` Token Cache Not Anchored to `globalThis`

**File**: `lib/erp-aero.ts`, lines 10–12
**Impact**: Like the inventory pool issue, `cachedToken` is a module-level variable. In Next.js serverless deployments, module re-evaluation resets this to `null`, forcing re-authentication on every cold start.

```ts
let cachedToken: string | null = null   // lost on module re-evaluation
let authPromise: Promise<string> | null = null
```

`lib/erp-client.ts` has the same issue (lines 18–20) but is slightly better because it includes a `tokenExpiresAt` TTL check.

**Suggestion**: Anchor both token caches to `globalThis`:
```ts
const g = globalThis as any
g._erpToken ??= { value: null, expiresAt: 0, promise: null }
```

---

## Index Analysis

### Covered (Existing Migration)

`migrations/add-status-indexes.sql` properly adds:
- `idx_ro_status`, `idx_ro_modified`, `idx_ro_status_modified` on `repair_orders`
- Equivalent indexes on `sales_orders`, `invoices`, `quote_requests`
- FK indexes on `repair_order_lines.repair_order_id`, `sales_order_lines.sales_order_id`, `invoice_lines.invoice_id`
- Audit log indexes on `audit_logs`

These are well-designed. Verify they have been applied to the production schema.

### Missing Indexes

| Table | Column(s) | Query Pattern | Priority |
|---|---|---|---|
| `parts` | `FULLTEXT(product_name, description, mfr_part_no, nsn_number, cage_code)` | `WHERE ... LIKE '%q%' OR ...` (5-column scan) | HIGH |
| `parts` | `(product_name)` | `ORDER BY product_name` in search results | MEDIUM |
| `parts` | `(erp_modified_at)` | `ORDER BY erp_modified_at DESC` in sync check | MEDIUM |
| `portal_users` | `(company_id)` | `LEFT JOIN companies ON pu.company_id = c.id` | MEDIUM |
| `portal_users` | `(is_active, id)` | `ORDER BY is_active ASC, id DESC` in clients list | LOW |
| `inventory_watchlist` | `(is_active)` | `WHERE is_active = 1` on every check call | MEDIUM |
| `inventory_alerts` | `(alert_type, acknowledged_at)` | `WHERE alert_type LIKE 'WATCHLIST_%' AND acknowledged_at IS NULL` | MEDIUM |
| `inventory_alerts` | `(created_at)` | `ORDER BY created_at DESC`, `DATE(created_at) = CURDATE()` | MEDIUM |

---

## Bundle & SSR Analysis

### Three.js Bundle Isolation

Three.js (~600 KB minified) is correctly isolated:
- `HeroSection.tsx` wraps `HeroIntro` with `next/dynamic({ ssr: false })` — correct
- `app/showcase/page.tsx` uses `next/dynamic` for `ParticleVertexAircraft` — correct
- Three.js is **not** imported anywhere in the internal dashboard or portal pages — correct

The isolation is solid. No action needed.

### Framer Motion

Framer Motion (~100 KB gzipped) is used only on the public-facing pages (`HeroIntro`, `FeaturedInventory`, `InstrumentCluster`, `MagneticButton`). It does not appear in any internal dashboard pages. This is acceptable.

### Font Loading

`app/layout.tsx` correctly uses `next/font/google` with `display: 'swap'` for both IBM Plex Sans and IBM Plex Mono. No issues.

### Image Optimization

`public/GenLogoNoBackground.png` is 80 KB and `GenLogoTab.png` is 60 KB — reasonable sizes for a logo. The logo is loaded via `next/image` with `priority` in `HeroIntro.tsx` (correct for LCP). The `aircraft.glb` model in `public/models/` is 404 KB — if it is not currently used, it should be removed from the public directory.

`next.config.js` has `images.remotePatterns: []` — no remote images are configured, which is correct and safe.

---

## Prioritized Optimization List

| Priority | Issue | Expected Improvement |
|---|---|---|
| 1 | **C1** — Parallelize watchlist alarm checks + batch DB writes | Alarm check: 10s → ~1s for 50 parts |
| 2 | **H1** — Fetch `v1/ro/list` once, share across consumers | Automation page: 60 ERP requests → 20 |
| 3 | **H4** — Add FULLTEXT index on `parts` search columns | Search latency: full table scan → indexed, 10–100× faster |
| 4 | **H3** — Anchor inventory pool to `globalThis` | Prevents connection pool leak on hot reload / cold start |
| 5 | **H2** — Increase `fetchAllPages` page_size from 25 to 100 | ERP fetches: 20 pages → 5 pages per list endpoint |
| 6 | **H5** — Dynamic import Recharts on bots page | Removes ~120 KB from bots route initial JS |
| 7 | **M4** — Make `getAllBotStatuses` async + cache result | Dashboard: up to 25s event loop block → non-blocking |
| 8 | **M5** — Use `tail` instead of full file read for bot metrics | Memory per request: 50 MB potential → ~500 KB |
| 9 | **M1** — Connect `useReducedMotion` to animation components | Accessibility compliance + GPU savings for affected users |
| 10 | **M6** — Batch watchlist `UPDATE` statements | N individual DB writes → 1 bulk operation |
| 11 | **L7/L2** — Anchor ERP token caches to `globalThis` | Eliminates forced re-auth on cold start |
| 12 | **L2** — Bypass React state in `MagneticButton` lerp loop | Eliminates 60 fps React reconcile during mouse movement |
| 13 | **M7** — Pause dashboard poll when tab is hidden | Reduces server load for AFK users |
| 14 | **L1** — Add sweep to in-memory rate limiter maps | Prevents unbounded memory growth |
| 15 | **L6** — Add `Cache-Control: no-store` to authenticated responses | Defense against accidental proxy caching |

---

*This report was generated by static analysis. No production metrics were available at time of audit. Latency estimates are based on observed code patterns and typical cloud/serverless response times.*
