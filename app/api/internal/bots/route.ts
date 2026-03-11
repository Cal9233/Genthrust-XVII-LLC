import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAllBotStatuses, getBotMetrics, getNotificationFeed } from '@/lib/bot-helpers'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const statuses = getAllBotStatuses()

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
    console.error('Bots API error:', error)
    return NextResponse.json({ error: 'Failed to load bot data' }, { status: 500 })
  }
}
