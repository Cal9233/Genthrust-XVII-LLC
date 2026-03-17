/**
 * Adaptive Card Builders — Teams Notification Templates
 * ======================================================
 * Builds Adaptive Card JSON objects programmatically for the Email
 * Intelligence System. All cards are version 1.4 (Teams-compatible).
 *
 * Three card types:
 *   1. URGENT — Individual high-score email with full context
 *   2. BATCH  — Collapsible list of 5-15 important emails
 *   3. DAILY DIGEST — Summary counts with gap warnings
 *
 * IMPORTANT: Cards are built as plain objects (NOT string templates).
 * All user-supplied text (sender, subject, body) is safely embedded
 * as JSON string values via object construction.
 */

import type { AdaptiveCard } from "./teams-notifier";

// ---------------------------------------------------------------------------
// Types (input data for card builders)
// ---------------------------------------------------------------------------

export interface ScoredEmailForCard {
  from: string;
  subject: string;
  bodyPreview: string;
  score: number;
  reason: string;
  webLink: string;
  receivedDateTime: string;
}

export interface ROContext {
  roNumber: string;
  shopName: string;
  partDescription: string;
  status: string;
  estimatedCost: number | null;
  finalCost: number | null;
}

export interface TodoContext {
  taskTitle: string;
  dueDate: string | null;
}

export interface ShopContext {
  businessName: string;
  contact: string | null;
  paymentTerms: string | null;
}

export interface DailyDigestStats {
  urgent: number;
  important: number;
  low: number;
  skipped: number;
  totalProcessed: number;
  roMatches: number;
  todoMatches: number;
}

export interface GapWarning {
  mailbox: string;
  lastSuccessAt: string | null;
  gapMinutes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_VERSION = "1.4";
const SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";
const MAX_BODY_PREVIEW = 200;

// ---------------------------------------------------------------------------
// Color helpers (Adaptive Cards use "attention", "good", "warning", "accent")
// ---------------------------------------------------------------------------

function getScoreColor(
  score: number
): "attention" | "warning" | "good" | "accent" {
  if (score >= 9) return "attention"; // red
  if (score >= 7) return "warning"; // yellow/orange
  if (score >= 5) return "accent"; // blue
  return "good"; // green
}

function getScoreEmoji(score: number): string {
  if (score >= 9) return "!!!";
  if (score >= 7) return "!!";
  if (score >= 5) return "!";
  return "";
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
}

function formatTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  } catch {
    return isoDate;
  }
}

// ---------------------------------------------------------------------------
// 1. URGENT Card
// ---------------------------------------------------------------------------

/**
 * Build an Adaptive Card for a single urgent email (score 7-10).
 * Includes optional RO context, To-Do context, and shop info.
 */
export function buildUrgentCard(
  email: ScoredEmailForCard,
  score: number,
  reason: string,
  roContext?: ROContext | null,
  todoContext?: TodoContext | null,
  shopContext?: ShopContext | null
): AdaptiveCard {
  const body: unknown[] = [];

  // Header with score badge
  body.push({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "auto",
        items: [
          {
            type: "TextBlock",
            text: `${score}/10 ${getScoreEmoji(score)}`,
            color: getScoreColor(score),
            weight: "Bolder",
            size: "ExtraLarge",
          },
        ],
      },
      {
        type: "Column",
        width: "stretch",
        items: [
          {
            type: "TextBlock",
            text: "Email Intelligence Alert",
            weight: "Bolder",
            size: "Medium",
          },
          {
            type: "TextBlock",
            text: formatTime(email.receivedDateTime),
            isSubtle: true,
            spacing: "None",
          },
        ],
      },
    ],
  });

  // Sender and subject
  body.push({
    type: "FactSet",
    facts: [
      { title: "From:", value: email.from },
      { title: "Subject:", value: email.subject },
    ],
  });

  // Reason
  body.push({
    type: "TextBlock",
    text: reason,
    wrap: true,
    isSubtle: true,
    spacing: "Small",
  });

  // Body preview
  if (email.bodyPreview) {
    body.push({
      type: "TextBlock",
      text: truncate(email.bodyPreview, MAX_BODY_PREVIEW),
      wrap: true,
      spacing: "Small",
      maxLines: 4,
    });
  }

  // RO Context section
  if (roContext) {
    body.push({
      type: "Container",
      style: "emphasis",
      spacing: "Medium",
      items: [
        {
          type: "TextBlock",
          text: "Repair Order Match",
          weight: "Bolder",
          spacing: "Small",
        },
        {
          type: "FactSet",
          facts: [
            { title: "RO #:", value: roContext.roNumber },
            { title: "Shop:", value: roContext.shopName },
            { title: "Part:", value: roContext.partDescription },
            { title: "Status:", value: roContext.status },
            ...(roContext.finalCost != null
              ? [
                  {
                    title: "Final Cost:",
                    value: `$${roContext.finalCost.toLocaleString()}`,
                  },
                ]
              : roContext.estimatedCost != null
                ? [
                    {
                      title: "Est. Cost:",
                      value: `$${roContext.estimatedCost.toLocaleString()}`,
                    },
                  ]
                : []),
          ],
        },
      ],
    });
  }

  // To-Do Context section
  if (todoContext) {
    body.push({
      type: "Container",
      style: "emphasis",
      spacing: "Medium",
      items: [
        {
          type: "TextBlock",
          text: "Related To-Do Task",
          weight: "Bolder",
          spacing: "Small",
        },
        {
          type: "TextBlock",
          text: todoContext.taskTitle,
          wrap: true,
        },
        ...(todoContext.dueDate
          ? [
              {
                type: "TextBlock",
                text: `Due: ${todoContext.dueDate}`,
                isSubtle: true,
                spacing: "None",
              },
            ]
          : []),
      ],
    });
  }

  // Shop info
  if (shopContext) {
    const shopFacts: Array<{ title: string; value: string }> = [
      { title: "Vendor:", value: shopContext.businessName },
    ];
    if (shopContext.contact) {
      shopFacts.push({ title: "Contact:", value: shopContext.contact });
    }
    if (shopContext.paymentTerms) {
      shopFacts.push({ title: "Terms:", value: shopContext.paymentTerms });
    }

    body.push({
      type: "Container",
      spacing: "Small",
      items: [
        {
          type: "FactSet",
          facts: shopFacts,
        },
      ],
    });
  }

  // Action button
  const actions: unknown[] = [
    {
      type: "Action.OpenUrl",
      title: "Open in Outlook",
      url: email.webLink,
    },
  ];

  return {
    type: "AdaptiveCard",
    version: CARD_VERSION,
    $schema: SCHEMA,
    body,
    actions,
  };
}

// ---------------------------------------------------------------------------
// 2. BATCH Card (30-min digest for score 5-6)
// ---------------------------------------------------------------------------

/**
 * Build an Adaptive Card for a batch of important (score 5-6) emails.
 * Uses Action.ToggleVisibility for collapsible email details.
 */
export function buildBatchCard(emails: ScoredEmailForCard[]): AdaptiveCard {
  const body: unknown[] = [];

  // Header
  body.push({
    type: "TextBlock",
    text: `Email Intelligence Batch (${emails.length} emails)`,
    weight: "Bolder",
    size: "Medium",
  });

  body.push({
    type: "TextBlock",
    text: `${formatTime(new Date().toISOString())} | Scores 5-6`,
    isSubtle: true,
    spacing: "None",
  });

  // Email list with collapsible details
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const detailId = `detail_${i}`;

    // Summary row (always visible)
    body.push({
      type: "ColumnSet",
      spacing: i === 0 ? "Medium" : "Small",
      selectAction: {
        type: "Action.ToggleVisibility",
        targetElements: [detailId],
      },
      columns: [
        {
          type: "Column",
          width: "auto",
          items: [
            {
              type: "TextBlock",
              text: `${email.score}`,
              color: getScoreColor(email.score),
              weight: "Bolder",
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: email.subject,
              weight: "Bolder",
              wrap: true,
              maxLines: 1,
            },
            {
              type: "TextBlock",
              text: `From: ${email.from}`,
              isSubtle: true,
              spacing: "None",
              size: "Small",
            },
          ],
        },
      ],
    });

    // Detail container (hidden by default, toggled on click)
    body.push({
      type: "Container",
      id: detailId,
      isVisible: false,
      spacing: "None",
      style: "emphasis",
      items: [
        {
          type: "TextBlock",
          text: truncate(email.bodyPreview, MAX_BODY_PREVIEW),
          wrap: true,
          size: "Small",
        },
        {
          type: "TextBlock",
          text: email.reason,
          wrap: true,
          isSubtle: true,
          size: "Small",
          spacing: "None",
        },
        {
          type: "ActionSet",
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Open",
              url: email.webLink,
            },
          ],
        },
      ],
    });
  }

  return {
    type: "AdaptiveCard",
    version: CARD_VERSION,
    $schema: SCHEMA,
    body,
  };
}

// ---------------------------------------------------------------------------
// 3. DAILY DIGEST Card
// ---------------------------------------------------------------------------

/**
 * Build an Adaptive Card for the daily digest (8 AM summary).
 * Includes counts per tier, RO/To-Do match rates, and gap warnings.
 */
export function buildDailyDigestCard(
  stats: DailyDigestStats,
  gapWarnings?: GapWarning[]
): AdaptiveCard {
  const body: unknown[] = [];

  // Header
  body.push({
    type: "TextBlock",
    text: "Email Intelligence Daily Digest",
    weight: "Bolder",
    size: "Medium",
  });

  body.push({
    type: "TextBlock",
    text: formatTime(new Date().toISOString()),
    isSubtle: true,
    spacing: "None",
  });

  // Summary stats
  body.push({
    type: "FactSet",
    spacing: "Medium",
    facts: [
      {
        title: "Total Processed:",
        value: String(stats.totalProcessed),
      },
      {
        title: "Urgent (7-10):",
        value: String(stats.urgent),
      },
      {
        title: "Important (5-6):",
        value: String(stats.important),
      },
      {
        title: "Low (1-4):",
        value: String(stats.low),
      },
      {
        title: "Skipped:",
        value: String(stats.skipped),
      },
    ],
  });

  // Context match stats
  if (stats.roMatches > 0 || stats.todoMatches > 0) {
    body.push({
      type: "Container",
      spacing: "Small",
      items: [
        {
          type: "TextBlock",
          text: "Context Matches",
          weight: "Bolder",
          spacing: "Small",
        },
        {
          type: "FactSet",
          facts: [
            {
              title: "RO Matches:",
              value: String(stats.roMatches),
            },
            {
              title: "To-Do Matches:",
              value: String(stats.todoMatches),
            },
          ],
        },
      ],
    });
  }

  // Gap warnings (monitoring health)
  if (gapWarnings && gapWarnings.length > 0) {
    const warningItems: unknown[] = [
      {
        type: "TextBlock",
        text: "Monitoring Gaps Detected",
        weight: "Bolder",
        color: "attention",
        spacing: "Small",
      },
    ];

    for (const gap of gapWarnings) {
      warningItems.push({
        type: "TextBlock",
        text: `${gap.mailbox}: last success ${
          gap.lastSuccessAt
            ? formatTime(gap.lastSuccessAt) +
              ` (${gap.gapMinutes} min ago)`
            : "NEVER"
        }`,
        wrap: true,
        color: "attention",
        size: "Small",
        spacing: "None",
      });
    }

    body.push({
      type: "Container",
      style: "attention",
      spacing: "Medium",
      items: warningItems,
    });
  }

  return {
    type: "AdaptiveCard",
    version: CARD_VERSION,
    $schema: SCHEMA,
    body,
  };
}
