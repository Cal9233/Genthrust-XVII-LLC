import { NextRequest, NextResponse } from 'next/server'
import { getLogTail, BOT_REGISTRY } from '@/lib/bot-helpers'
import { requireInternalSession } from '@/lib/api-auth'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInternalSession()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const bot = searchParams.get('bot') || 'ils'
    const lines = Math.min(parseInt(searchParams.get('lines') || '100'), 500)

    if (!BOT_REGISTRY[bot]) {
      return NextResponse.json({ error: `Invalid bot: ${bot}` }, { status: 400 })
    }

    const { content, sizeBytes } = getLogTail(bot, lines)

    return NextResponse.json({
      bot,
      displayName: BOT_REGISTRY[bot].displayName,
      content,
      logSizeBytes: sizeBytes,
    })
  } catch (error) {
    console.error('Bot logs API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load bot logs' }, { status: 500 })
  }
}
