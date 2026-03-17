/**
 * Email Rules Engine — Pre-filter for email scoring
 *
 * Order: blocklist → VIP → keyword → null (needs LLM)
 * Blocklist: score 0, skipLlm true
 * VIP: score floor 7, skipLlm false (still goes to LLM for context scoring)
 * Keywords: scored by urgency/suppression, skipLlm true
 * Rules loaded from email_monitor_rules table, cached per poll run
 */

import { query } from "@/lib/db";

// ==========================================
// TYPES
// ==========================================

export interface RuleResult {
  score: number | null;
  method: "rules" | "llm";
  skipLlm: boolean;
}

interface MonitorRule {
  id: number;
  rule_type: "vip" | "blocklist" | "keyword_boost" | "keyword_suppress";
  pattern: string;
  score_effect: number | null;
}

interface CachedRules {
  vip: MonitorRule[];
  blocklist: MonitorRule[];
  keywordBoost: MonitorRule[];
  keywordSuppress: MonitorRule[];
}

// ==========================================
// BUILT-IN KEYWORD PATTERNS (always active)
// ==========================================

const URGENT_KEYWORDS = [
  "aog",
  "aircraft on ground",
  "faa ad",
  "airworthiness directive",
  "easa",
];

const BUSINESS_KEYWORDS = [
  "rfq",
  "request for quote",
  "purchase order",
  "po #",
  "ready for pickup",
  "repair complete",
  "work order complete",
];

const SUPPRESS_KEYWORDS = [
  "unsubscribe",
  "newsletter",
  "promotional",
  "automated message",
  "no-reply",
  "noreply",
];

// ==========================================
// RULE CACHE (per poll run)
// ==========================================

let cachedRules: CachedRules | null = null;

/**
 * Load rules from DB and cache them. Call once per poll run.
 */
export async function loadRules(): Promise<CachedRules> {
  const rows = await query<MonitorRule[]>(
    "SELECT id, rule_type, pattern, score_effect FROM email_monitor_rules"
  );

  cachedRules = {
    vip: rows.filter((r) => r.rule_type === "vip"),
    blocklist: rows.filter((r) => r.rule_type === "blocklist"),
    keywordBoost: rows.filter((r) => r.rule_type === "keyword_boost"),
    keywordSuppress: rows.filter((r) => r.rule_type === "keyword_suppress"),
  };

  return cachedRules;
}

/**
 * Clear the cached rules (call at end of poll or on error)
 */
export function clearRulesCache(): void {
  cachedRules = null;
}

// ==========================================
// MATCHING HELPERS
// ==========================================

function matchesBlocklist(
  email: { from: string },
  rules: MonitorRule[]
): boolean {
  const fromLower = email.from.toLowerCase();
  const fromDomain = extractDomain(fromLower);

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    // Match full address or domain
    if (fromLower.includes(pattern) || fromDomain === pattern) {
      return true;
    }
  }
  return false;
}

function matchesVip(
  email: { from: string },
  rules: MonitorRule[]
): MonitorRule | null {
  const fromLower = email.from.toLowerCase();
  const fromDomain = extractDomain(fromLower);

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (fromLower.includes(pattern) || fromDomain === pattern) {
      return rule;
    }
  }
  return null;
}

function matchesKeywords(
  text: string,
  keywords: string[]
): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function matchesDbKeywords(
  text: string,
  rules: MonitorRule[]
): MonitorRule | null {
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.pattern.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

function extractDomain(emailOrAddress: string): string {
  // Handle "Name <email@domain.com>" format
  const match = emailOrAddress.match(/@([^>]+)/);
  return match ? match[1].toLowerCase() : "";
}

// ==========================================
// MAIN EXPORT
// ==========================================

/**
 * Apply rules engine to an email.
 * Must call loadRules() before first use in a poll run.
 *
 * @returns RuleResult with score/method/skipLlm, or score=null when LLM needed
 */
export function applyRules(email: {
  from: string;
  subject: string;
  bodyPreview: string;
}): RuleResult {
  const rules = cachedRules;
  if (!rules) {
    // Rules not loaded — conservative: send to LLM
    return { score: null, method: "llm", skipLlm: false };
  }

  // 1. BLOCKLIST CHECK (highest priority — reject before anything else)
  if (matchesBlocklist(email, rules.blocklist)) {
    return { score: 0, method: "rules", skipLlm: true };
  }

  // 2. VIP CHECK — set a score floor, but still send to LLM for context
  const vipMatch = matchesVip(email, rules.vip);
  if (vipMatch) {
    const floor = vipMatch.score_effect ?? 7;
    return { score: Math.max(floor, 7), method: "rules", skipLlm: false };
  }

  // 3. KEYWORD CHECKS (subject + bodyPreview combined)
  const searchText = `${email.subject} ${email.bodyPreview}`;

  // 3a. Built-in urgent keywords
  if (matchesKeywords(searchText, URGENT_KEYWORDS)) {
    return { score: 9, method: "rules", skipLlm: true };
  }

  // 3b. DB-configured keyword boosts
  const boostMatch = matchesDbKeywords(searchText, rules.keywordBoost);
  if (boostMatch) {
    return {
      score: boostMatch.score_effect ?? 8,
      method: "rules",
      skipLlm: true,
    };
  }

  // 3c. Built-in business keywords
  if (matchesKeywords(searchText, BUSINESS_KEYWORDS)) {
    return { score: 8, method: "rules", skipLlm: true };
  }

  // 3d. Built-in suppress keywords
  if (matchesKeywords(searchText, SUPPRESS_KEYWORDS)) {
    return { score: 2, method: "rules", skipLlm: true };
  }

  // 3e. DB-configured keyword suppressions
  const suppressMatch = matchesDbKeywords(searchText, rules.keywordSuppress);
  if (suppressMatch) {
    return {
      score: suppressMatch.score_effect ?? 2,
      method: "rules",
      skipLlm: true,
    };
  }

  // 4. No rule matched — needs LLM scoring
  return { score: null, method: "llm", skipLlm: false };
}
