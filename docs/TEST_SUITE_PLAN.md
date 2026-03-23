# Comprehensive Test Suite Plan — Genthrust XVII-LLC

> Production-readiness quality gate. Generated 2026-03-22.

## Test Strategy Overview

**Baseline:** 1029 tests passing across 51 files (post-security audit).

**Coverage Gaps Identified:**
- 62 of 68 API routes have no dedicated tests
- 61 of 66 React components have no tests
- 0 E2E tests exist
- Auth/MFA/admin endpoints have near-zero test coverage

**Approach:** Risk-prioritized testing. Security-critical paths first, then business logic CRUD, then UI components.

---

## Test Suite Structure

### Tier 1: Auth & Security (CRITICAL)

| Test File | Routes Covered | Priority |
|-----------|---------------|----------|
| `__tests__/api/portal/mfa-flow.test.ts` | MFA enroll, verify, disable, status | Critical |
| `__tests__/api/register.test.ts` | Client registration + companies | Critical |
| `__tests__/api/contact.test.ts` | Contact form submission | Critical |
| `__tests__/api/admin-create-client.test.ts` | Admin user provisioning | Critical |
| `__tests__/api/mcp-endpoint.test.ts` | MCP auth + tool exposure | Critical |
| `__tests__/api/search.test.ts` | Global search | High |
| `__tests__/api/portal/portal-dashboard.test.ts` | Portal dashboard stats | High |

### Tier 2: Internal CRUD Routes (HIGH)

| Test File | Routes Covered | Priority |
|-----------|---------------|----------|
| `__tests__/api/internal/repair-orders.test.ts` | RO list + detail | High |
| `__tests__/api/internal/invoices.test.ts` | Invoice list + detail | High |
| `__tests__/api/internal/sales-orders.test.ts` | SO list + detail | High |
| `__tests__/api/internal/quotes-crud.test.ts` | Quote CRUD + export + sync + send | High |
| `__tests__/api/internal/clients-management.test.ts` | Client CRUD + activation | High |
| `__tests__/api/internal/dashboard-api.test.ts` | Dashboard + status overview | High |

### Tier 3: Internal Service Routes (HIGH)

| Test File | Routes Covered | Priority |
|-----------|---------------|----------|
| `__tests__/api/internal/bots-api.test.ts` | Bot fleet status, inventory, logs, restart | High |
| `__tests__/api/internal/email-api.test.ts` | Email send, draft, monitor, thread | High |
| `__tests__/api/internal/inventory-intelligence-api.test.ts` | Inventory search, batch, add, PDF parse | Medium |
| `__tests__/api/internal/inventory-alarms-api.test.ts` | Alarms, check, search, acknowledge, watchlist | Medium |
| `__tests__/api/internal/sync-audit-diag.test.ts` | Parts sync, audit log, diagnostics | Medium |
| `__tests__/api/internal/chat-api.test.ts` | AI chat with tool calling | Medium |

### Tier 4: React Components (MEDIUM)

| Test File | Components Covered | Priority |
|-----------|-------------------|----------|
| `__tests__/components/TabNav.test.tsx` | TabNav (6 tabs, mobile menu) | High |
| `__tests__/components/DetailDrawer.test.tsx` | DetailDrawer, DrawerMetaGrid, DrawerLineItems | High |
| `__tests__/components/ChartCard.test.tsx` | ChartCard | Medium |
| `__tests__/components/dashboard-cards.test.tsx` | 6 dashboard status cards | Medium |
| `__tests__/components/ChatPanel.test.tsx` | ChatPanel, ChatPanelWrapper | Medium |
| `__tests__/components/portal/MfaEnrollment.test.tsx` | MFA QR enrollment flow | High |
| `__tests__/components/portal/MfaChallenge.test.tsx` | TOTP challenge input | High |
| `__tests__/components/layout/Navbar.test.tsx` | Navigation bar | Medium |
| `__tests__/components/layout/Footer.test.tsx` | Footer | Low |
| `__tests__/components/ui-primitives.test.tsx` | Button, Modal, Dialog, Spinner, etc. | Low |
| `__tests__/components/sections.test.tsx` | ContactSection, FeaturedInventory, etc. | Low |

---

## Test Patterns

### API Route Testing Pattern
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies before imports
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({ auth: mockAuth }))
const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({ query: mockQuery }))

function createRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('GET /api/internal/repair-orders', () => {
  beforeEach(() => { vi.resetModules(); mockAuth.mockReset(); mockQuery.mockReset() })

  it('returns 401 for unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/internal/repair-orders/route')
    const res = await GET(createRequest('/api/internal/repair-orders'))
    expect(res.status).toBe(401)
  })
})
```

### Component Testing Pattern
```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('next/navigation', () => ({
  usePathname: () => '/internal',
  useRouter: () => ({ push: vi.fn() }),
}))

import TabNav from '@/components/internal/TabNav'

describe('TabNav', () => {
  it('renders all navigation tabs', () => {
    render(<TabNav />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('ERP')).toBeInTheDocument()
  })
})
```

---

## Mock Strategy

| Dependency | Mock Approach |
|-----------|---------------|
| `@/auth` | `vi.mock()` with configurable session factory |
| `@/lib/db` | `vi.mock()` query/safeQuery/safeCount returning test data |
| `@/lib/audit-logger` | `vi.mock()` no-op (returns undefined) |
| `@/lib/rate-limit` | `vi.mock()` always allows (configurable for rate-limit tests) |
| `@/lib/mfa` | `vi.mock()` returns test secrets/QR codes |
| Graph API client | `vi.mock()` returns test email data |
| AI SDK | `vi.mock('ai')` returns mock streaming response |
| ERP client | `vi.mock()` returns test parts data |
| Three.js / R3F | `vi.mock()` with DOM fallback components |
| Framer Motion | `vi.mock()` passthrough div elements |
| next/navigation | `vi.mock()` with test pathname/router |

---

## Coverage Goals

| Category | Current | Target |
|----------|---------|--------|
| API Routes with Tests | 6/68 (9%) | 60/68 (88%) |
| Components with Tests | 5/66 (8%) | 40/66 (61%) |
| Test Files | 51 | 75+ |
| Total Tests | 1029 | 1800+ |

---

## Blockers

- **No real DB in CI** — all DB tests use mocked `query()`. Integration tests against real MySQL would require Docker compose.
- **No Resend API key** — contact form tests mock the send call.
- **No Azure AD** — SSO tests mock the MSAL client.
- **No Trigger.dev** — job tests mock the SDK.

---

## CI/CD Integration

```yaml
# Recommended GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npm ci
    - run: npx vitest run --reporter=verbose
    - run: npm run build
```
