import { query } from '@/lib/db'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACTION_TYPES = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  READ: 'READ',
  SEND_EMAIL: 'SEND_EMAIL',
  AI_CHAT: 'AI_CHAT',
  MFA_VERIFY: 'MFA_VERIFY',
  MFA_DISABLE: 'MFA_DISABLE',
  MFA_ENROLL: 'MFA_ENROLL',
  RATE_LIMITED: 'RATE_LIMITED',
  BOT_RESTART: 'BOT_RESTART',
  SYNC: 'SYNC',
  EXPORT: 'EXPORT',
} as const

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES]

export const RESOURCE_TYPES = {
  REPAIR_ORDER: 'repair_order',
  SALES_ORDER: 'sales_order',
  INVOICE: 'invoice',
  QUOTE: 'quote',
  CLIENT: 'client',
  INVENTORY: 'inventory',
  EMAIL: 'email',
  CHAT: 'chat',
  BOT: 'bot',
  MFA: 'mfa',
} as const

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEvent {
  id?: number
  timestamp?: string
  user_id?: string | null
  user_email?: string | null
  user_role?: 'internal' | 'client' | 'system' | null
  action: string
  resource_type?: string | null
  resource_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  method?: string | null
  path?: string | null
  status_code?: number | null
  success?: boolean
  error_message?: string | null
  metadata?: Record<string, any> | null
  duration_ms?: number | null
}

// ---------------------------------------------------------------------------
// Core logger — fire-and-forget
// ---------------------------------------------------------------------------

export async function logAuditEvent(event: Partial<AuditEvent>): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
        (user_id, user_email, user_role, action, resource_type, resource_id,
         ip_address, user_agent, method, path, status_code, success,
         error_message, metadata, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.user_id ?? null,
        event.user_email ?? null,
        event.user_role ?? null,
        event.action ?? 'UNKNOWN',
        event.resource_type ?? null,
        event.resource_id ?? null,
        event.ip_address ?? null,
        event.user_agent ?? null,
        event.method ?? null,
        event.path ?? null,
        event.status_code ?? null,
        event.success ?? true,
        event.error_message ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.duration_ms ?? null,
      ]
    )
  } catch (err) {
    console.error('Audit log write failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Request context helper
// ---------------------------------------------------------------------------

export function createAuditContext(
  req: NextRequest,
  session: any
): Partial<AuditEvent> {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp ?? null

  return {
    ip_address: ip,
    user_agent: req.headers.get('user-agent') ?? undefined,
    method: req.method,
    path: req.nextUrl.pathname,
    user_id: session?.user?.id ?? session?.user?.email ?? null,
    user_email: session?.user?.email ?? null,
    user_role: (session?.user as any)?.role ?? null,
  }
}

// ---------------------------------------------------------------------------
// Diff helper — computes changed fields for mutation metadata
// ---------------------------------------------------------------------------

export function diffObjects(
  before: Record<string, any>,
  after: Record<string, any>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const oldVal = before[key]
    const newVal = after[key]
    // Stringify for deep comparison of objects/arrays
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null }
    }
  }

  return changes
}
