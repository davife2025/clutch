'use client'
interface TopBarProps { title: string; actions?: React.ReactNode }

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
