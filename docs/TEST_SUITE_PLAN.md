# Test Suite — Genthrust XVII LLC

> Post-refactor state. Run `npm run test:run` for current count.

## Current Test Surface

427 tests across 19 files covering the remaining features.

## Test Files

### API Routes
| Test File | Routes Covered |
|-----------|---------------|
| `__tests__/api/internal/bots-api.test.ts` | Bot fleet status, inventory, logs, restart |
| `__tests__/api/internal/sso-flightdeck.test.ts` | SSO redirect flow |
| `__tests__/api/contact.test.ts` | Contact form submission |

### Trigger Tasks
| Test File | Coverage |
|-----------|---------|
| `__tests__/trigger-exports.test.ts` | excel-sync, move-ro-sheet — task IDs and Zod schema validation |

### Infrastructure
| Test File | Coverage |
|-----------|---------|
| `__tests__/middleware.test.ts` | CSP nonce generation, /api/internal protection |
| `__tests__/csp-regression.test.ts` | CSP header regression |
| `__tests__/lib/rate-limit-redis.test.ts` | Rate limiter (Redis + in-memory fallback) |
| `__tests__/lib/sso-redirect.test.ts` | SSO token generation and verification |
| `__tests__/lib/db-shutdown.test.ts` | DB pool shutdown |
| `__tests__/inventory-db.test.cjs` | Bot inventory DB queries |
| `__tests__/schema.test.ts` | Drizzle schema definitions |
| `__tests__/date-utils.test.ts` | Date utilities |
| `__tests__/quote-api-logic.test.ts` | Quote logic (legacy, kept for regression) |

### Components
| Test File | Coverage |
|-----------|---------|
| `__tests__/components/layout/Navbar.test.tsx` | Nav links, Login SSO link, mobile menu |
| `__tests__/components/layout/Footer.test.tsx` | Footer content |
| `__tests__/components/sections.test.tsx` | ContactSection, ServicesBento, StatsBar |
| `__tests__/components/ui-primitives.test.tsx` | Button, Modal, Dialog, Spinner, etc. |
| `__tests__/components/ParticleVertexAircraft.test.tsx` | 3D aircraft component |

## Test Patterns

### API Route
```typescript
vi.mock('@/auth', () => ({ auth: vi.fn() }))
const mockAuth = vi.mocked(auth)

it('returns 401 for unauthenticated', async () => {
  mockAuth.mockResolvedValue(null)
  const res = await GET()
  expect(res.status).toBe(401)
})
```

### Trigger Task
```typescript
import { syncRepairOrders, syncRepairOrdersPayloadSchema } from '@/trigger/excel-sync'

it('has correct task id', () => {
  expect(syncRepairOrders.id).toBe('sync-repair-orders')
})
```

## Blockers

- No real DB in CI — all DB tests use mocked `query()`
- No Resend API key — contact form tests mock fetch
- No Azure AD — SSO tests mock the `auth()` session
- No Trigger.dev — task tests mock the SDK
