import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { BOT_REGISTRY } from '@/lib/bot-helpers'
import { logAuditEvent, ACTION_TYPES, RESOURCE_TYPES } from '@/lib/audit-logger'
import { requireInternalSession } from '@/lib/api-auth'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

const execFileAsync = promisify(execFile)

const RestartBotSchema = z.object({
  botName: z.string().min(1).max(50),
  confirm: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireInternalSession()
    if (!authResult.ok) return authResult.response
    const { session, role } = authResult

    const body = await request.json()
    const parsed = RestartBotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { botName, confirm } = parsed.data

    if (!BOT_REGISTRY[botName]) {
      return NextResponse.json({ error: `Invalid bot: ${botName}` }, { status: 400 })
    }

    if (!confirm) {
      return NextResponse.json({
        action: 'restart_preview',
        bot: botName,
        serviceName: BOT_REGISTRY[botName].serviceName,
        message: `Would restart ${BOT_REGISTRY[botName].displayName}. Send confirm: true to execute.`,
      })
    }

    const serviceName = BOT_REGISTRY[botName].serviceName

    try {
      await execFileAsync('nssm', ['restart', serviceName], { timeout: 30000 })

      logAuditEvent({
        action: ACTION_TYPES.BOT_RESTART,
        resource_type: RESOURCE_TYPES.BOT,
        resource_id: botName,
        user_id: session.user.id,
        user_email: session.user.email ?? null,
        user_role: role === 'admin' ? 'internal' : role,
        success: true,
        status_code: 200,
        metadata: { botName, serviceName },
      }).catch(() => {})

      return NextResponse.json({
        action: 'restart_executed',
        bot: botName,
        success: true,
        message: `${BOT_REGISTRY[botName].displayName} restarted successfully`,
      })
    } catch (err: any) {
      const msg = err.message || ''

      logAuditEvent({
        action: ACTION_TYPES.BOT_RESTART,
        resource_type: RESOURCE_TYPES.BOT,
        resource_id: botName,
        user_id: session.user.id,
        user_email: session.user.email ?? null,
        user_role: role === 'admin' ? 'internal' : role,
        success: false,
        error_message: msg.substring(0, 500),
        metadata: { botName, serviceName },
      }).catch(() => {})

      if (msg.includes('Access') || msg.includes('privilege') || msg.includes('denied')) {
        return NextResponse.json({
          action: 'restart_failed',
          bot: botName,
          success: false,
          message: 'Requires admin privileges. Run the Next.js server as Administrator.',
        }, { status: 403 })
      }
      return NextResponse.json({
        action: 'restart_failed',
        bot: botName,
        success: false,
        message: `Restart failed: ${msg.substring(0, 200)}`,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Bot restart API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to restart bot' }, { status: 500 })
  }
}
