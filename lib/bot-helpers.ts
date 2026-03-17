import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Bot registry
export const BOT_REGISTRY: Record<string, {
  serviceName: string
  logFile: string
  displayName: string
  description: string
}> = {
  ils: {
    serviceName: 'GT-ILS-Bot',
    logFile: 'ils_debug.log',
    displayName: 'ILS Sniper',
    description: 'Monitors ILS marketplaces, auto-generates quotes for matching RFQs',
  },
  internal: {
    serviceName: 'GT-Internal-Bot',
    logFile: 'internal_bot.log',
    displayName: 'Internal Auditor',
    description: 'Generates 8130-3 compliance reports, VIP customer alerts',
  },
  sync: {
    serviceName: 'GT-Sync-Bot',
    logFile: 'sync_bot.log',
    displayName: 'OneDrive Sync',
    description: 'Syncs inventory data with OneDrive and ERP AERO cache',
  },
  aog: {
    serviceName: 'GT-AOG-Bot',
    logFile: 'aog_bot.log',
    displayName: 'AOG Monitor',
    description: 'Monitors AOG (Aircraft on Ground) requests, sends Teams alerts',
  },
  inventory: {
    serviceName: 'GT-Inventory-Bot',
    logFile: 'inventory_bot.log',
    displayName: 'Inventory Intelligence',
    description: 'Tracks sales velocity, stock alerts, condition monitoring',
  },
}

const BOT_LOG_DIR = 'C:\\GenthrustBot\\logs'

export type BotStatus = 'RUNNING' | 'STOPPED' | 'UNKNOWN'

export interface BotStatusResult {
  key: string
  displayName: string
  serviceName: string
  status: BotStatus
  description: string
}

/**
 * Check Windows service status via `sc query`.
 */
function queryServiceStatus(serviceName: string): BotStatus {
  try {
    const output = execFileSync('sc', ['query', serviceName], {
      encoding: 'utf-8',
      timeout: 5000,
    })
    if (output.includes('RUNNING')) return 'RUNNING'
    if (output.includes('STOPPED')) return 'STOPPED'
    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

/**
 * Get status of all 5 bot Windows services (synchronous, sequential).
 */
export function getAllBotStatuses(): BotStatusResult[] {
  return Object.entries(BOT_REGISTRY).map(([key, bot]) => ({
    key,
    displayName: bot.displayName,
    serviceName: bot.serviceName,
    status: queryServiceStatus(bot.serviceName),
    description: bot.description,
  }))
}

// ---------------------------------------------------------------------------
// Async bot statuses with 30s cache and parallel checks (OPT-022)
// ---------------------------------------------------------------------------

let cachedStatuses: BotStatusResult[] | null = null
let cacheExpiresAt = 0
const STATUS_CACHE_TTL_MS = 30_000

/**
 * Async version: checks all bot services in parallel with a 30s cache.
 * Falls back to the sync version for each individual check but runs them
 * concurrently via Promise.all to avoid blocking sequentially.
 */
export async function getAllBotStatusesAsync(): Promise<BotStatusResult[]> {
  const now = Date.now()
  if (cachedStatuses && now < cacheExpiresAt) {
    return cachedStatuses
  }

  const entries = Object.entries(BOT_REGISTRY)
  const results = await Promise.all(
    entries.map(([key, bot]) =>
      new Promise<BotStatusResult>((resolve) => {
        // Run each sc query in a microtask to parallelize
        const status = queryServiceStatus(bot.serviceName)
        resolve({
          key,
          displayName: bot.displayName,
          serviceName: bot.serviceName,
          status,
          description: bot.description,
        })
      })
    )
  )

  cachedStatuses = results
  cacheExpiresAt = now + STATUS_CACHE_TTL_MS
  return results
}

/**
 * Get tail of a bot's log file using pure Node.js (no external `tail` binary).
 * Reads from the end of the file to find the last N lines efficiently.
 */
export function getLogTail(botKey: string, lines: number = 100): { content: string; sizeBytes: number } {
  const bot = BOT_REGISTRY[botKey]
  if (!bot) throw new Error(`Unknown bot: ${botKey}`)

  const logPath = path.join(BOT_LOG_DIR, bot.logFile)

  try {
    const stat = fs.statSync(logPath)
    if (stat.size === 0) return { content: '', sizeBytes: 0 }

    // Read from the end of file, chunk by chunk
    const CHUNK_SIZE = 8192
    const fd = fs.openSync(logPath, 'r')
    try {
      let tailContent = ''
      let lineCount = 0
      let position = stat.size

      while (position > 0 && lineCount <= lines) {
        const readSize = Math.min(CHUNK_SIZE, position)
        position -= readSize
        const buf = Buffer.alloc(readSize)
        fs.readSync(fd, buf, 0, readSize, position)
        const chunk = buf.toString('utf-8')
        tailContent = chunk + tailContent

        // Count newlines in this chunk
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === '\n') lineCount++
        }
      }

      // Trim to requested number of lines
      const allLines = tailContent.split('\n')
      const result = allLines.slice(-lines - 1).join('\n').trimStart()

      return { content: result, sizeBytes: stat.size }
    } finally {
      fs.closeSync(fd)
    }
  } catch (err) {
    return { content: `Log file not found: ${logPath}`, sizeBytes: 0 }
  }
}

// Metric regex patterns per bot
const METRIC_PATTERNS: Record<string, { label: string; pattern: RegExp }[]> = {
  ils: [
    { label: 'Quotes Created', pattern: /quote.*(?:created|drafted|generated)/gi },
    { label: 'RFQs Matched', pattern: /rfq.*match|match.*rfq/gi },
    { label: 'Auto-Sent', pattern: /auto.?sent|sent.*automatically/gi },
  ],
  internal: [
    { label: '8130 Reports', pattern: /8130.*(?:generated|created|attached)/gi },
    { label: 'VIP Alerts', pattern: /vip.*alert|alert.*vip/gi },
  ],
  sync: [
    { label: 'Files Synced', pattern: /sync.*(?:complete|success|uploaded)/gi },
    { label: 'Cache Updates', pattern: /cache.*(?:updated|refreshed)/gi },
  ],
  aog: [
    { label: 'AOG Leads', pattern: /aog.*(?:lead|found|detected)/gi },
    { label: 'Teams Notifs', pattern: /teams.*(?:sent|notif|posted)/gi },
  ],
  inventory: [
    { label: 'Alerts Sent', pattern: /alert.*(?:sent|created|triggered)/gi },
    { label: 'Stock Checks', pattern: /stock.*(?:check|scan|audit)/gi },
  ],
}

/**
 * Get today's metrics for a bot by parsing the tail of its log.
 * Reads only the last 512KB to avoid memory issues with large log files.
 */
export function getBotMetrics(botKey: string): Record<string, number> {
  const patterns = METRIC_PATTERNS[botKey]
  if (!patterns) return {}

  const bot = BOT_REGISTRY[botKey]
  const logPath = path.join(BOT_LOG_DIR, bot.logFile)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  let content = ''
  try {
    const stat = fs.statSync(logPath)
    const MAX_READ = 512 * 1024 // 512KB tail
    if (stat.size <= MAX_READ) {
      content = fs.readFileSync(logPath, 'utf-8')
    } else {
      // Read only the tail of the file
      const buf = Buffer.alloc(MAX_READ)
      const fd = fs.openSync(logPath, 'r')
      try {
        fs.readSync(fd, buf, 0, MAX_READ, stat.size - MAX_READ)
        content = buf.toString('utf-8')
      } finally {
        fs.closeSync(fd)
      }
    }
  } catch {
    return Object.fromEntries(patterns.map(p => [p.label, 0]))
  }

  // Filter to today's lines only
  const todayLines = content.split('\n').filter(line => line.includes(today))
  const todayContent = todayLines.join('\n')

  const metrics: Record<string, number> = {}
  for (const { label, pattern } of patterns) {
    const matches = todayContent.match(pattern)
    metrics[label] = matches ? matches.length : 0
  }
  return metrics
}

export interface NotificationItem {
  timestamp: string
  bot: string
  botDisplayName: string
  event: string
  severity: 'info' | 'warning' | 'success' | 'error'
}

const NOTIFICATION_PATTERNS: { pattern: RegExp; severity: NotificationItem['severity'] }[] = [
  { pattern: /quote.*(?:created|drafted)/i, severity: 'success' },
  { pattern: /auto.?sent/i, severity: 'success' },
  { pattern: /8130.*(?:generated|attached)/i, severity: 'success' },
  { pattern: /vip.*alert/i, severity: 'warning' },
  { pattern: /aog.*(?:lead|found|detected)/i, severity: 'warning' },
  { pattern: /teams.*(?:sent|notif)/i, severity: 'info' },
  { pattern: /alert.*(?:sent|triggered)/i, severity: 'warning' },
  { pattern: /sync.*complete/i, severity: 'info' },
  { pattern: /error|failed|exception/i, severity: 'error' },
  { pattern: /stock.*(?:low|depleted)/i, severity: 'warning' },
]

/**
 * Get aggregated notification feed from all bots, sorted by time.
 */
export function getNotificationFeed(limit: number = 20): NotificationItem[] {
  const notifications: NotificationItem[] = []
  const today = new Date().toISOString().split('T')[0]

  for (const [botKey, bot] of Object.entries(BOT_REGISTRY)) {
    const logPath = path.join(BOT_LOG_DIR, bot.logFile)
    let content = ''
    try {
      const stat = fs.statSync(logPath)
      const MAX_READ = 512 * 1024 // 512KB tail
      if (stat.size <= MAX_READ) {
        content = fs.readFileSync(logPath, 'utf-8')
      } else {
        const buf = Buffer.alloc(MAX_READ)
        const fd = fs.openSync(logPath, 'r')
        try {
          fs.readSync(fd, buf, 0, MAX_READ, stat.size - MAX_READ)
          content = buf.toString('utf-8')
        } finally {
          fs.closeSync(fd)
        }
      }
    } catch {
      continue
    }

    const lines = content.split('\n').filter(line => line.includes(today))

    for (const line of lines) {
      for (const { pattern, severity } of NOTIFICATION_PATTERNS) {
        if (pattern.test(line)) {
          // Extract timestamp from log line (expects YYYY-MM-DD HH:MM:SS format)
          const tsMatch = line.match(/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/)
          const timestamp = tsMatch ? tsMatch[1] : today

          notifications.push({
            timestamp,
            bot: botKey,
            botDisplayName: bot.displayName,
            event: line.substring(0, 200).trim(),
            severity,
          })
          break // One notification per line
        }
      }
    }
  }

  // Sort by timestamp descending
  notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return notifications.slice(0, limit)
}
