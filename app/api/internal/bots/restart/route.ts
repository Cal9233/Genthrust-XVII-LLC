import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { execSync } from 'child_process'
import { BOT_REGISTRY } from '@/lib/bot-helpers'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { botName, confirm } = body

    if (!botName || !BOT_REGISTRY[botName]) {
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
      execSync(`nssm restart "${serviceName}"`, { encoding: 'utf-8', timeout: 30000 })
      return NextResponse.json({
        action: 'restart_executed',
        bot: botName,
        success: true,
        message: `${BOT_REGISTRY[botName].displayName} restarted successfully`,
      })
    } catch (err: any) {
      const msg = err.message || ''
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
    console.error('Bot restart API error:', error)
    return NextResponse.json({ error: 'Failed to restart bot' }, { status: 500 })
  }
}
