import { NextResponse } from 'next/server'
import { getAllBotStatusesAsync, getBotMetrics, getNotificationFeed } from '@/lib/bot-helpers'
import { requireInternalSession } from '@/lib/api-auth'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireInternalSession()
    if (!auth.ok) return auth.response

    const statuses = await getAllBotStatusesAsync()

    const metrics: Record<string, Record<string, number>> = {}
    for (const bot of statuses) {
      try {
        metrics[bot.key] = getBotMetrics(bot.key)
      } catch {
        metrics[bot.key] = {}
      }
    }

    const notifications = getNotificationFeed(20)

    return NextResponse.json({ statuses, metrics, notifications })
  } catch (error) {
    console.error('Bots API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to load bot data' }, { status: 500 })
  }
}
