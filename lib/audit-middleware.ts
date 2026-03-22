import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import {
  logAuditEvent,
  createAuditContext,
  ACTION_TYPES,
  RESOURCE_TYPES,
} from '@/lib/audit-logger'

// ---------------------------------------------------------------------------
// Method → default action mapping
// ---------------------------------------------------------------------------

const METHOD_ACTION_MAP: Record<string, string> = {
  GET: ACTION_TYPES.READ,
  POST: ACTION_TYPES.CREATE,
  PUT: ACTION_TYPES.UPDATE,
  PATCH: ACTION_TYPES.UPDATE,
  DELETE: ACTION_TYPES.DELETE,
}

// ---------------------------------------------------------------------------
// Path segment → resource type inference
// ---------------------------------------------------------------------------

const PATH_RESOURCE_MAP: Record<string, string> = {
  clients: RESOURCE_TYPES.CLIENT,
  quotes: RESOURCE_TYPES.QUOTE,
  invoices: RESOURCE_TYPES.INVOICE,
  'repair-orders': RESOURCE_TYPES.REPAIR_ORDER,
  'sales-orders': RESOURCE_TYPES.SALES_ORDER,
  inventory: RESOURCE_TYPES.INVENTORY,
  email: RESOURCE_TYPES.EMAIL,
  chat: RESOURCE_TYPES.CHAT,
  bots: RESOURCE_TYPES.BOT,
  mfa: RESOURCE_TYPES.MFA,
}

function inferResourceType(pathname: string): string | undefined {
  const segments = pathname.split('/')
  for (const segment of segments) {
    if (PATH_RESOURCE_MAP[segment]) return PATH_RESOURCE_MAP[segment]
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Higher-order audit wrapper
// ---------------------------------------------------------------------------

interface AuditOptions {
  /** Override the action type (e.g. ACTION_TYPES.SEND_EMAIL) */
  action?: string
  /** Override the resource type (e.g. RESOURCE_TYPES.EMAIL) */
  resourceType?: string
  /** Skip reading the request body (for streaming or large payloads) */
  skipBody?: boolean
}

/**
 * Wraps an API route handler with fire-and-forget audit logging.
 *
 * - Records start time and session context before the handler runs.
 * - After the handler completes, logs the audit event asynchronously.
 * - On handler error, logs with success=false and re-throws.
 * - Never delays the response — logAuditEvent is fire-and-forget.
 */
export function withAuditLog(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  options?: AuditOptions
): (req: NextRequest, context?: any) => Promise<Response> {
  return async (req: NextRequest, context?: any): Promise<Response> => {
    const start = Date.now()

    // Get session for audit context (auth() reads from cookies/headers)
    let session: any = null
    try {
      session = await auth()
    } catch {
      // If auth fails we still want to run the handler — log without user info
    }

    const auditBase = createAuditContext(req, session)
    const action = options?.action ?? METHOD_ACTION_MAP[req.method] ?? req.method
    const resourceType = options?.resourceType ?? inferResourceType(req.nextUrl.pathname)

    try {
      const response = await handler(req, context)

      // Fire-and-forget audit log — do NOT await in the response path
      logAuditEvent({
        ...auditBase,
        action,
        resource_type: resourceType,
        status_code: response.status,
        success: response.status < 400,
        duration_ms: Date.now() - start,
      }).catch(() => {}) // swallow — already logged internally

      return response
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Fire-and-forget error audit
      logAuditEvent({
        ...auditBase,
        action,
        resource_type: resourceType,
        status_code: 500,
        success: false,
        error_message: errorMessage.substring(0, 1000),
        duration_ms: Date.now() - start,
      }).catch(() => {})

      throw error
    }
  }
}
