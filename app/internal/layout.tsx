import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import InternalNav from '@/components/internal/InternalNav'

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/signin')
  }

  if ((session.user as any).role !== 'internal') {
    // Client users must not access the internal dashboard
    redirect('/portal')
  }

  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'GT'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-navy-900 text-white border-b border-navy-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/internal" className="flex items-center gap-2">
            <Image
              src="/GenLogoNoBackground.png"
              alt="GENTHRUST"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="font-bold tracking-wider hidden sm:inline-block">
              GENTHRUST <span className="text-burgundy-400">INTERNAL</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-slate-400">{session.user.email}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-burgundy-600 flex items-center justify-center font-bold text-sm shadow-inner overflow-hidden">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
            </div>

            <div className="w-px h-6 bg-navy-700 mx-2" />

            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/' })
              }}
            >
              <button
                type="submit"
                className="p-2 text-slate-300 hover:text-white hover:bg-navy-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline-block">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
        <InternalNav />
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
