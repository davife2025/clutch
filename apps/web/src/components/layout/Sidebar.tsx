'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, ArrowLeftRight, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutUser } from '@/lib/auth'

const NAV = [
  { href: '/dashboard',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/wallets',   label: 'Wallets',       icon: Wallet },
  { href: '/dashboard/activity',  label: 'Activity',      icon: ArrowLeftRight },
  { href: '/dashboard/settings',  label: 'Settings',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 border-r border-zinc-800 bg-zinc-950 px-3 py-5">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <span className="text-2xl">🫙</span>
        <span className="text-lg font-bold text-white tracking-tight">Clutch</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            )}>
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <button onClick={logoutUser}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors w-full">
        <LogOut size={17} />
        Sign out
      </button>
    </aside>
  )
}
