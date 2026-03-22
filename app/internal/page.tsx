import { auth } from '@/auth'
import DashboardClient from '@/components/internal/DashboardClient'

export default async function InternalDashboardPage() {
  const session = await auth()
  const userName = session?.user?.name ?? 'there'

  return <DashboardClient userName={userName} />
}
