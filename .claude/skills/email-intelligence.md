---
description: Working with email intelligence pipeline, inbox monitoring, Exchange/Graph integration, or Trigger.dev cron tasks
globs: ["trigger/**", "lib/graph/**", "lib/services/email-*", "app/api/internal/email/**", "components/internal/EmailIntelligenceCard.tsx"]
---

Load @docs/EMAIL_INTELLIGENCE_SETUP.md for full pipeline architecture and deployment guide.

Key files:
- @lib/graph/daemon-client.ts — MSAL singleton, certificate-based auth (module-level, do NOT recreate per request)
- trigger/inbox-monitor.ts — 5-min cron orchestrator
- trigger/email-digest.ts — 30-min batch dispatcher
- trigger/daily-digest.ts — 8 AM daily summary

Architecture: 3-layer (Outlook Favorites → Exchange Transport Rules → AI Monitor via Trigger.dev + Graph API + Claude Haiku).
Cost: ~$0.45/month — rules engine handles ~80% of emails, Haiku scores the remaining 20%.

IMPORTANT: Azure cert expires 2027-03-17 — regenerate before that date.
MONITOR_APP_CERT_PEM must ONLY be in Trigger.dev runtime, NOT in .env.local.
Trigger.dev runs separately from Next.js — it needs its own DB_* env vars set in the Trigger.dev dashboard.
