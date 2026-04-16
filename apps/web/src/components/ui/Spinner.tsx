import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('animate-spin rounded-full border-2 border-zinc-700 border-t-green-400 w-5 h-5', className)} />
  )
}
