import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const dynamic = 'force-dynamic'

const NET30_SCRIPT = `import sys, json
sys.path.insert(0, r'C:\\GenThrust\\automation')
from dotenv import load_dotenv
load_dotenv(r'C:\\GenThrust\\automation\\.env')
import net30_reminders
payment = net30_reminders.process_reminders(dry_run=True)
followup = net30_reminders.process_followup_reminders(dry_run=True)
print(json.dumps({"payment_reminders": payment, "followup_reminders": followup}, default=str))
`

const DIGEST_SCRIPT = `import sys, json
sys.path.insert(0, r'C:\\GenThrust\\automation')
from dotenv import load_dotenv
load_dotenv(r'C:\\GenThrust\\automation\\.env')
import ro_status_digest
stats = ro_status_digest.run_digest(dry_run=True)
print(json.dumps({"stats": stats}, default=str))
`

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

    const script = type === 'net30' ? NET30_SCRIPT : DIGEST_SCRIPT

    try {
      // Use execFile (not execSync/shell) — passes script as a direct argument, no shell injection risk
      const { stdout } = await execFileAsync(
        'C:\\GenThrust\\automation\\.venv\\Scripts\\python.exe',
        ['-c', script],
        {
          encoding: 'utf-8',
          timeout: 60000,
          cwd: 'C:\\GenThrust\\automation',
        }
      )

      const result = JSON.parse(stdout.trim())
      return NextResponse.json({ type, mode: 'dry_run', ...result })
    } catch (err: any) {
      return NextResponse.json({
        type,
        error: `Preview failed: ${(err.message || '').substring(0, 300)}`,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Automation preview API error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
