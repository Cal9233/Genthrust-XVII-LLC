# Email Intelligence System — Setup & Deployment Guide

> Genthrust XVII LLC — Internal Documentation
> Last updated: 2026-03-17

---

## 1. Overview

The Email Intelligence System monitors all `@genthrust.net` mailboxes, cross-references incoming emails against active repair orders in MySQL, Microsoft To-Do tasks, and known vendors/shops. It scores importance using a combination of rules-based pre-filtering and Claude Haiku AI, then sends tiered Microsoft Teams notifications.

### Architecture

3-layer system providing escalating coverage:

1. **Layer 1 — Outlook Favorites** (immediate, manual setup)
2. **Layer 2 — Exchange Transport Rules** (server-side, keyword-based)
3. **Layer 3 — Custom AI Monitor** (Trigger.dev cron + Graph API + Claude Haiku)

### Cost

~$0.45/month (Claude Haiku tokens). Layer 3 handles only the ~20% of emails that rules cannot classify — the rest are scored entirely by the rules engine at zero cost.

### Components

- **15 source files** (services, Graph clients, Trigger.dev tasks, API routes, dashboard widget)
- **9 test files**
- **3 Trigger.dev cron tasks** (inbox-monitor, email-digest, daily-digest)
- **3 database tables** (email_monitor_state, email_monitor_log, email_monitor_rules)

---

## 2. Prerequisites Completed

- [x] **Azure Entra ID daemon app registration created**
  - App Name: `Genthrust Email Monitor (Daemon)`
  - Client ID: `<your-daemon-app-client-id>`
  - Tenant ID: `<your-tenant-id>`
- [x] **Self-signed certificate generated** (valid 1 year from 2026-03-17)
  - Thumbprint: `<your-cert-thumbprint>`
  - Files: `~/monitor-cert.pem` (public), `~/monitor-key.pem` (private)
  - **IMPORTANT: Regenerate before 2027-03-17**
- [x] **Mail.Read application permission** granted + admin consent
- [x] **Exchange ServicePrincipal registered**
  - Object ID: `<your-service-principal-object-id>`
- [x] **Teams Workflows webhook** created
- [x] **Healthchecks.io check** created (5 min period, 25 min grace)
- [ ] **RBAC scoping** — SKIPPED
  - Exchange Online Business Premium does not expose `ManagementRole` cmdlets.
  - Tenant is `@genthrust.net` only, so blast radius is limited.
  - Revisit when upgrading to E3/E5.

---

## 3. Remaining Setup Steps

### Step 1: Run Database Migration

```bash
cd /mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC

# Option A: Using env vars from .env.local
source .env.local
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/add-email-intelligence.sql

# Option B: Direct
mysql -u <user> -p genthrust < migrations/add-email-intelligence.sql
```

This creates 3 tables:

| Table | Purpose |
|-------|---------|
| `email_monitor_state` | Delta link + heartbeat per mailbox |
| `email_monitor_log` | Email processing log (PII-minimized) |
| `email_monitor_rules` | Admin-editable VIP/blocklist/keyword rules |

### Step 2: Set Environment Variables in Trigger.dev Dashboard

Go to your Trigger.dev project dashboard → **Settings → Environment Variables**.

**Required vars** (Trigger.dev runtime ONLY — NOT in `.env.local`):

```
MONITOR_APP_CLIENT_ID=<your-daemon-app-client-id>
MONITOR_APP_TENANT_ID=<your-tenant-id>
MONITOR_APP_CERT_THUMBPRINT=<your-cert-thumbprint>
MONITOR_APP_CERT_PEM=<base64-encoded contents of ~/monitor-key-b64.txt>
MONITORED_MAILBOXES=cmalagon@genthrust.net,info@genthrust.net
TEAMS_WORKFLOW_WEBHOOK_URL=<your Teams Workflows webhook URL>
HEALTHCHECKS_IO_URL=https://hc-ping.com/<your-check-uuid>
EMAIL_SCORE_URGENT_THRESHOLD=7
```

**Database vars** (also needed in Trigger.dev — it runs separately from Next.js):

```
DB_HOST=<your mysql host>
DB_PORT=3306
DB_USER=<your mysql user>
DB_PASSWORD=<your mysql password>
DB_NAME=genthrust
```

To get the base64 cert PEM:

```bash
cat ~/monitor-key-b64.txt
```

> **SECURITY**: The `MONITOR_APP_CERT_PEM` must ONLY be in Trigger.dev runtime, NOT in the web app's `.env.local`. This isolates the daemon credential from web app compromise.

### Step 3: Deploy Trigger.dev Tasks

```bash
cd /mnt/c/Users/calvi/Projects/Genthrust-XVII-LLC
npx trigger.dev@latest deploy
```

This registers 3 new cron tasks:

| Task | Schedule | Purpose |
|------|----------|---------|
| `inbox-monitor` | Every 5 minutes | Main orchestrator — poll, score, notify |
| `email-digest` | Every 30 minutes | Batched IMPORTANT tier notifications |
| `daily-digest` | 8:00 AM ET daily | Summary of all activity |

### Step 4: Seed Initial VIP/Blocklist Rules

After migration, seed the rules table with known important contacts:

```sql
-- VIP senders (always score 7+)
INSERT INTO email_monitor_rules (rule_type, pattern, pattern_type, score_effect, description) VALUES
('vip', '@apa-airlines.com', 'domain', 8, 'Asia Pacific Airlines - key customer'),
('vip', '@heliparts.com', 'domain', 8, 'Heliparts - repair vendor'),
('vip', '@faa.gov', 'domain', 9, 'FAA regulatory'),
('vip', '@easa.europa.eu', 'domain', 9, 'EASA regulatory');

-- Blocklist (always score 0, skip processing)
INSERT INTO email_monitor_rules (rule_type, pattern, pattern_type, score_effect, description) VALUES
('blocklist', 'noreply@', 'address_prefix', 0, 'No-reply addresses'),
('blocklist', '@marketing.', 'domain_contains', 0, 'Marketing domains'),
('blocklist', 'newsletter', 'subject_keyword', 0, 'Newsletter emails');

-- Keyword boosts
INSERT INTO email_monitor_rules (rule_type, pattern, pattern_type, score_effect, description) VALUES
('keyword_boost', 'AOG', 'subject_keyword', 9, 'Aircraft on Ground - critical'),
('keyword_boost', 'RFQ', 'subject_keyword', 8, 'Request for Quote'),
('keyword_boost', 'ready for pickup', 'subject_keyword', 8, 'Shop work complete'),
('keyword_boost', 'work order', 'subject_keyword', 7, 'Work order update'),
('keyword_boost', 'purchase order', 'subject_keyword', 7, 'Purchase order'),
('keyword_boost', 'invoice', 'subject_keyword', 6, 'Invoice/payment');
```

Customize these with your actual vendor domains, customer domains, and relevant keywords.

### Step 5: Verify Deployment

1. **Trigger.dev dashboard**: Confirm 3 new tasks appear (`inbox-monitor`, `email-digest`, `daily-digest`)
2. **Wait 5 minutes**: `inbox-monitor` should fire its first run
3. **Healthchecks.io**: Should show green ping within 5 minutes
4. **Teams channel**: Should receive first notification (or silence if no important emails)
5. **Genthrust dashboard** (`/internal`): `EmailIntelligenceCard` widget should show monitor status

### Step 6: Test with Real Email

Send a test email to `cmalagon@genthrust.net` or `info@genthrust.net` with subject **"RFQ Test - Urgent"** from an external address. Within 5 minutes you should see a Teams notification.

---

## 4. Layer 1 & 2 Setup (Immediate Coverage)

These layers provide coverage RIGHT NOW while Layer 3 is being deployed.

### Layer 1: Outlook Mobile (5 minutes)

1. Open Outlook Mobile → **Settings → Notifications**
2. Set **"Notify me for: Favorite People"**
3. Star these contacts: key customers, shop contacts, FAA/EASA addresses, `info@genthrust.net`

### Layer 2: Exchange Transport Rules (30 minutes)

1. Go to **admin.exchange.microsoft.com → Mail Flow → Rules**
2. Create these rules:

| Rule Name | Condition | Action |
|-----------|-----------|--------|
| AOG Alert | Subject contains "AOG" or "aircraft on ground" | Forward to `alerts@genthrust.net`, set importance HIGH |
| RFQ Alert | Subject contains "RFQ" or "request for quote" or "quotation" | Forward to `alerts@genthrust.net` |
| PO/Invoice | Subject contains "purchase order" or "PO #" or "invoice" | Forward to `alerts@genthrust.net` |
| Shop Work Order | Subject contains "ready for pickup" or "work order" or "quote approved" or "repair complete" | Forward to `alerts@genthrust.net`, set importance HIGH |
| Regulatory | From domain `faa.gov` or `easa.europa.eu` | Forward to `alerts@genthrust.net`, set importance HIGH |

3. Create shared mailbox `alerts@genthrust.net` (free in M365) if it doesn't exist
4. Add `alerts@genthrust.net` to Outlook Mobile with ALL notifications on

---

## 5. Notification Tiers

| Tier | Score | Behavior | Example |
|------|-------|----------|---------|
| **URGENT** | 7–10 | Immediate Teams notification | AOG request, RFQ from key customer, regulatory notice |
| **IMPORTANT** | 5–6 | Batched every 30 min | General business inquiry, routine vendor quote |
| **LOW** | 1–4 | Daily digest at 8 AM ET | Newsletter, internal FYI, automated notification |

**Quiet hours** (10 PM – 6 AM ET): Only score 9–10 breaks through. Everything else queued for morning.

---

## 6. Architecture

```
Every 5 min (Trigger.dev inbox-monitor):
  1. POLL: Delta query each @genthrust.net mailbox via Graph API
  2. DEDUP: Check by Graph message ID + content hash (internetMessageId)
  3. PRE-FILTER: Rules engine (VIP, blocklist, keywords) — handles ~80%
  4. CONTEXT ENRICHMENT (the differentiator):
     a. Match email against active repair orders in MySQL
     b. Cross-reference Calvin's Microsoft To-Do tasks
     c. Recognize known shops/vendors from database
  5. AI SCORING: Claude Haiku for remaining ~20% of emails
  6. ROUTE: Score → tier → notify or queue
  7. HEARTBEAT: Ping Healthchecks.io
```

---

## 7. Files Reference

### Source Files (15)

| File | Purpose |
|------|---------|
| `lib/graph/daemon-client.ts` | MSAL singleton, certificate-based auth |
| `lib/graph/inbox-reader.ts` | Delta query with pagination |
| `lib/graph/todo-reader.ts` | To-Do task fetching via Graph |
| `lib/services/email-rules-engine.ts` | VIP/blocklist/keyword pre-filter |
| `lib/services/email-context-enricher.ts` | RO + To-Do + shop cross-reference |
| `lib/services/email-haiku-scorer.ts` | Claude Haiku scoring with injection defense |
| `lib/services/email-quiet-hours.ts` | Timezone-aware quiet hours |
| `lib/services/teams-notifier.ts` | Workflows webhook + Adaptive Cards |
| `lib/services/adaptive-cards.ts` | Card template builders |
| `trigger/inbox-monitor.ts` | 5-min cron orchestrator |
| `trigger/email-digest.ts` | 30-min batch dispatcher |
| `trigger/daily-digest.ts` | 8 AM daily summary |
| `migrations/add-email-intelligence.sql` | 3 tables, 6 indexes |
| `components/internal/EmailIntelligenceCard.tsx` | Dashboard widget |
| `app/api/internal/email/monitor/route.ts` | Dashboard API |

### Test Files (9)

Located in `__tests__/` — covering rules engine, context enricher, Haiku scorer, quiet hours, Teams notifier, Adaptive Cards, inbox reader, deduplication, and integration scenarios.

---

## 8. Maintenance

### Certificate Rotation (before 2027-03-17)

```bash
# Generate new certificate
openssl req -x509 -newkey rsa:2048 \
  -keyout monitor-key.pem -out monitor-cert.pem \
  -days 365 -nodes -subj "/CN=Genthrust Email Monitor"

# Get thumbprint
openssl x509 -in monitor-cert.pem -noout -fingerprint -sha1

# Base64 encode private key for Trigger.dev
base64 -w0 monitor-key.pem > monitor-key-b64.txt
```

Then:
1. Upload new `monitor-cert.pem` to Azure Entra ID app registration
2. Update `MONITOR_APP_CERT_PEM` in Trigger.dev with contents of `monitor-key-b64.txt`
3. Update `MONITOR_APP_CERT_THUMBPRINT` in Trigger.dev with new thumbprint
4. Remove old certificate from Azure after confirming new one works

### Routine Maintenance

| Task | Frequency | How |
|------|-----------|-----|
| VIP/blocklist updates | As needed | Edit `email_monitor_rules` table directly (or future admin UI) |
| Teams webhook URL rotation | If URL changes | Update `TEAMS_WORKFLOW_WEBHOOK_URL` in Trigger.dev |
| Healthchecks.io | None needed | Free tier, no maintenance |
| RBAC scoping | On license upgrade | Revisit when upgrading to E3/E5 |
| Log cleanup | Monthly | Purge `email_monitor_log` entries older than 90 days |

---

## 9. Known Limitations & Future Work

### Current Limitations

- **RBAC scoping not applied** — Business Premium license does not expose `ManagementRole` cmdlets
- **RO regex** does not match "Repair Order XXXX" format (only "RO #XXXX")
- **Part number regex** misses solid alphanumeric patterns without delimiters
- **Delta link SSRF** not validated (low risk — requires DB compromise to exploit)
- **No admin UI** for rules management yet (direct SQL for now)
- **10 MEDIUM issues** documented in test report

### Future Work

- Admin UI for managing VIP/blocklist/keyword rules
- Support additional mailbox patterns dynamically
- Expand RO regex to match more repair order formats
- Add part number detection for alphanumeric patterns
- Apply RBAC scoping after E3/E5 upgrade
- Delta link URL validation

---

## 10. Troubleshooting

| Issue | Check |
|-------|-------|
| No notifications | Trigger.dev dashboard — check `inbox-monitor` runs. Look for errors in run logs. |
| Auth errors | Verify `MONITOR_APP_CERT_PEM` is correct base64. Check cert hasn't expired. |
| Missing emails | Check `MONITORED_MAILBOXES` env var. Verify `Mail.Read` permission is admin-consented. |
| Duplicate notifications | Check `email_monitor_log` for duplicate `email_graph_id` entries. Verify concurrency limit is set. |
| Healthchecks.io red | Trigger.dev may be down. Check `status.trigger.dev`. |
| Teams webhook 4xx | Webhook URL may have expired. Recreate in Teams Workflows. |
| Wrong scores | Review `email_monitor_rules` table. Check LLM model is `haiku` not `sonnet`. |
| High token costs | Check Anthropic dashboard. If costs spike, the rules engine may not be filtering enough — add more blocklist/keyword rules. |
