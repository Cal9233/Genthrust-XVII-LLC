import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getLogTail, BOT_REGISTRY } from '@/lib/bot-helpers'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    console.error('Bot logs API error:', error)
    return NextResponse.json({ error: 'Failed to load bot logs' }, { status: 500 })
  }
}
