import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import InternalShell from '@/components/internal/InternalShell'
import ChatPanelWrapper from '@/components/internal/ChatPanelWrapper'

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/signin')
  }

  if ((session.user as any).role !== 'internal') {
    redirect('/portal')
  }

  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'GT'

  return (
    <div className="internal-theme min-h-screen bg-[#0b0f14]">
      <InternalShell
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        userInitials={initials}
      >
        {children}
      </InternalShell>
      <ChatPanelWrapper />
    </div>
  )
}
