import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user as any).role !== 'internal') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'net30'

    if (!['net30', 'digest'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be net30 or digest.' }, { status: 400 })
    }

    let script: string
    if (type === 'net30') {
      script = `
import sys, json
sys.path.insert(0, r'C:\\GenThrust\\automation')
from dotenv import load_dotenv
load_dotenv(r'C:\\GenThrust\\automation\\.env')
import net30_reminders
payment = net30_reminders.process_reminders(dry_run=True)
followup = net30_reminders.process_followup_reminders(dry_run=True)
print(json.dumps({"payment_reminders": payment, "followup_reminders": followup}, default=str))
`
    } else {
      script = `
import sys, json
sys.path.insert(0, r'C:\\GenThrust\\automation')
from dotenv import load_dotenv
load_dotenv(r'C:\\GenThrust\\automation\\.env')
import ro_status_digest
stats = ro_status_digest.run_digest(dry_run=True)
print(json.dumps({"stats": stats}, default=str))
`
    }

    try {
      const output = execSync(`"C:\\GenThrust\\automation\\.venv\\Scripts\\python.exe" -c "${script.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: 'C:\\GenThrust\\automation',
      })

      const result = JSON.parse(output.trim())
      return NextResponse.json({ type, mode: 'dry_run', ...result })
    } catch (err: any) {
      return NextResponse.json({
        type,
        error: `Preview failed: ${(err.message || '').substring(0, 300)}`,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Automation preview API error:', error)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
