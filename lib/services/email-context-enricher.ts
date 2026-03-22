/**
 * Email Context Enricher — THE DIFFERENTIATOR
 *
 * Cross-references incoming emails against:
 *   A. Active repair orders (MySQL `active` table)
 *   B. Open Microsoft To-Do tasks
 *   C. Known shops/vendors (`shops` table)
 *
 * Returns structured context that feeds into the Haiku scorer's prompt,
 * enabling aviation-specific, business-aware email scoring.
 */

import { query } from "@/lib/db";

// ==========================================
// TYPES
// ==========================================

export interface ActiveRO {
  ro: number | null;
  shopName: string | null;
  part: string | null;
  serial: string | null;
  partDescription: string | null;
  reqWork: string | null;
  estimatedCost: number | null;
  finalCost: number | null;
  shopStatus: string | null;
}

export interface TodoTask {
  id: string;
  title: string;
  body?: string;
  status?: string;
}

export interface Shop {
  businessName: string | null;
  email: string | null;
  contact: string | null;
  paymentTerms: string | null;
}

export interface EmailContext {
  roMatches: ActiveRO[];
  todoMatches: TodoTask[];
  shopMatch: Shop | null;
}

interface EmailInput {
  from: string;
  subject: string;
  bodyPreview: string;
}

// ==========================================
// REGEX PATTERNS
// ==========================================

/** Match RO numbers like "RO #4521", "RO4521", "RO# 4521" */
const RO_REGEX = /\bRO\s*#?\s*(\d{3,6})\b/gi;

/**
 * Match aviation part number patterns:
 *  - Dash-separated alphanumeric: 206-011-114-001, 3G2750A00191
 *  - P/N prefix: P/N 206-011-114-001
 */
const PART_NUMBER_REGEX =
  /\b(?:P\/N\s*)?(\d{1,4}[A-Z]?\d*[-][\dA-Z][\dA-Z-]{3,})\b/gi;

// ==========================================
// EXTRACTION HELPERS
// ==========================================

function extractRoNumbers(text: string): number[] {
  const matches: number[] = [];
  let match: RegExpExecArray | null;
  RO_REGEX.lastIndex = 0;
  while ((match = RO_REGEX.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && !matches.includes(num)) {
      matches.push(num);
    }
  }
  return matches;
}

function extractPartNumbers(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  PART_NUMBER_REGEX.lastIndex = 0;
  while ((match = PART_NUMBER_REGEX.exec(text)) !== null) {
    const pn = match[1].toUpperCase();
    if (!matches.includes(pn)) {
      matches.push(pn);
    }
  }
  return matches;
}

function extractDomain(from: string): string {
  const match = from.match(/@([^>\s]+)/);
  return match ? match[1].toLowerCase() : "";
}

function extractSenderName(from: string): string {
  // "John Smith <john@example.com>" -> "John Smith"
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  // "john@example.com" -> "john"
  const atMatch = from.match(/^([^@]+)@/);
  return atMatch ? atMatch[1].replace(/[._-]/g, " ").trim() : from;
}

// ==========================================
// A. REPAIR ORDER MATCHING
// ==========================================

async function findRoMatches(
  email: EmailInput
): Promise<ActiveRO[]> {
  const searchText = `${email.subject} ${email.bodyPreview}`;

  const roNumbers = extractRoNumbers(searchText);
  const partNumbers = extractPartNumbers(searchText);
  const senderDomain = extractDomain(email.from);

  // Build dynamic query with OR conditions
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const ro of roNumbers) {
    conditions.push("RO = ?");
    params.push(ro);
  }

  for (const pn of partNumbers) {
    conditions.push("PART LIKE ?");
    params.push(`%${pn}%`);
  }

  // Match shop name by sender domain (strip TLD for fuzzy match)
  if (senderDomain) {
    const domainBase = senderDomain.split(".")[0]; // e.g. "heliparts" from "heliparts.com"
    if (domainBase.length >= 3) {
      conditions.push("LOWER(SHOP_NAME) LIKE ?");
      params.push(`%${domainBase}%`);
    }
  }

  if (conditions.length === 0) {
    return [];
  }

  const sqlQuery = `
    SELECT RO as ro, SHOP_NAME as shopName, PART as part, \`SERIAL\` as serial,
           PART_DESCRIPTION as partDescription, REQ_WORK as reqWork,
           ESTIMATED_COST as estimatedCost, FINAL_COST as finalCost,
           SHOP_STATUS as shopStatus
    FROM active
    WHERE ${conditions.join(" OR ")}
    LIMIT 10
  `;

  try {
    const rows = await query<ActiveRO[]>(sqlQuery, params);
    return rows;
  } catch (error) {
    console.error("[email-context-enricher] RO match query failed:", error);
    return [];
  }
}

// ==========================================
// B. TO-DO CROSS-REFERENCE
// ==========================================

function findTodoMatches(
  email: EmailInput,
  openTasks: TodoTask[],
  roMatches: ActiveRO[]
): TodoTask[] {
  if (!openTasks || openTasks.length === 0) return [];

  const senderName = extractSenderName(email.from).toLowerCase();
  const senderDomain = extractDomain(email.from);
  const domainBase = senderDomain.split(".")[0].toLowerCase();

  // Collect identifiers from email and RO matches
  const roNumbers = extractRoNumbers(`${email.subject} ${email.bodyPreview}`);
  const partNumbers = extractPartNumbers(`${email.subject} ${email.bodyPreview}`);
  const shopNames = roMatches
    .map((ro) => ro.shopName?.toLowerCase())
    .filter(Boolean) as string[];

  const matched: TodoTask[] = [];

  for (const task of openTasks) {
    const taskText = `${task.title} ${task.body || ""}`.toLowerCase();
    let isMatch = false;

    // Check sender name / shop name in task
    if (senderName.length >= 3 && taskText.includes(senderName)) {
      isMatch = true;
    }
    if (domainBase.length >= 3 && taskText.includes(domainBase)) {
      isMatch = true;
    }
    for (const shop of shopNames) {
      if (shop.length >= 3 && taskText.includes(shop)) {
        isMatch = true;
      }
    }

    // Check RO numbers in task
    for (const ro of roNumbers) {
      if (taskText.includes(String(ro))) {
        isMatch = true;
      }
    }

    // Check part numbers in task
    for (const pn of partNumbers) {
      if (taskText.includes(pn.toLowerCase())) {
        isMatch = true;
      }
    }

    if (isMatch && !matched.some((m) => m.id === task.id)) {
      matched.push(task);
    }
  }

  return matched;
}

// ==========================================
// C. SHOP/VENDOR RECOGNITION
// ==========================================

async function findShopMatch(email: EmailInput): Promise<Shop | null> {
  const senderDomain = extractDomain(email.from);
  if (!senderDomain) return null;

  try {
    const rows = await query<Shop[]>(
      `SELECT Business_Name as businessName, Email as email,
              Contact as contact, Payment_Terms as paymentTerms
       FROM shops
       WHERE LOWER(Email) LIKE ?
       LIMIT 1`,
      [`%${senderDomain}%`]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("[email-context-enricher] Shop match query failed:", error);
    return null;
  }
}

// ==========================================
// MAIN EXPORT
// ==========================================

/**
 * Enrich an email with cross-system context from repair orders,
 * Microsoft To-Do tasks, and known shops/vendors.
 */
export async function enrichEmailContext(
  email: EmailInput,
  openTasks: TodoTask[]
): Promise<EmailContext> {
  // Run RO matching and shop recognition in parallel
  const [roMatches, shopMatch] = await Promise.all([
    findRoMatches(email),
    findShopMatch(email),
  ]);

  // To-Do matching is CPU-only, runs synchronously
  const todoMatches = findTodoMatches(email, openTasks, roMatches);

  return { roMatches, todoMatches, shopMatch };
}
