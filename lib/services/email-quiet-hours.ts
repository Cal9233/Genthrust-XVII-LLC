/**
 * Quiet Hours — Timezone-aware notification suppression
 *
 * During quiet hours, only score >= 9 sends immediately.
 * Score 7-8 queued for morning batch at quiet hours end.
 *
 * Uses date-fns-tz for timezone conversion.
 * Cross-midnight range: hour >= start || hour < end (NOT &&)
 * If env vars missing or invalid, defaults to NO quiet hours (conservative).
 */

import { toZonedTime, fromZonedTime } from "date-fns-tz";

// ==========================================
// CONFIG
// ==========================================

function getConfig(): {
  start: number;
  end: number;
  timezone: string;
  enabled: boolean;
} {
  const startRaw = process.env.QUIET_HOURS_START;
  const endRaw = process.env.QUIET_HOURS_END;
  const timezone = process.env.QUIET_HOURS_TIMEZONE || "America/New_York";

  // If env vars not set, quiet hours are disabled (conservative default)
  if (!startRaw || !endRaw) {
    return { start: 0, end: 0, timezone, enabled: false };
  }

  const start = parseInt(startRaw, 10);
  const end = parseInt(endRaw, 10);

  // Validate: must be valid hours (0-23)
  if (isNaN(start) || isNaN(end) || start < 0 || start > 23 || end < 0 || end > 23) {
    console.warn(
      `[quiet-hours] Invalid config: start=${startRaw}, end=${endRaw}. Quiet hours disabled.`
    );
    return { start: 0, end: 0, timezone, enabled: false };
  }

  return { start, end, timezone, enabled: true };
}

// ==========================================
// EXPORTS
// ==========================================

/**
 * Check if the current time falls within quiet hours.
 * Returns false if quiet hours are not configured (conservative default).
 */
export function isQuietHours(): boolean {
  const config = getConfig();
  if (!config.enabled) return false;

  try {
    const now = toZonedTime(new Date(), config.timezone);
    const currentHour = now.getHours();

    // Cross-midnight range: e.g., 22:00 - 06:00
    // Active when hour >= 22 OR hour < 6
    if (config.start > config.end) {
      return currentHour >= config.start || currentHour < config.end;
    }

    // Same-day range: e.g., 13:00 - 17:00
    // Active when hour >= 13 AND hour < 17
    return currentHour >= config.start && currentHour < config.end;
  } catch (error) {
    console.error("[quiet-hours] Timezone conversion failed:", error);
    return false; // Conservative: don't suppress notifications on error
  }
}

/**
 * Get the Date when quiet hours end (next occurrence).
 * Used to schedule morning batch notifications.
 *
 * Correctness: toZonedTime returns a Date whose .getHours() reflects the
 * configured timezone. setHours() then sets wall-clock hours in that same
 * shifted representation. fromZonedTime converts that wall-clock time back
 * to a proper UTC instant, avoiding the off-by-UTC-offset bug that would
 * occur if setHours/getHours were called on a plain JS Date on a UTC server.
 */
export function getQuietHoursEnd(): Date {
  const config = getConfig();
  if (!config.enabled) return new Date(); // Already past quiet hours

  try {
    const nowUtc = new Date();
    // Shift internal UTC value so .getHours() returns the local hour in config.timezone
    const nowZoned = toZonedTime(nowUtc, config.timezone);

    // Set end hour on the shifted date (still in "zoned wall clock" space)
    const endZoned = new Date(nowZoned);
    endZoned.setHours(config.end, 0, 0, 0);

    // Convert the zoned wall-clock representation back to a real UTC instant
    let endUtc = fromZonedTime(endZoned, config.timezone);

    // If the end time is already past, advance one day
    if (endUtc <= nowUtc) {
      endZoned.setDate(endZoned.getDate() + 1);
      endUtc = fromZonedTime(endZoned, config.timezone);
    }

    return endUtc;
  } catch {
    return new Date(); // Conservative fallback
  }
}
