'use client'
import { Wifi, WifiOff, Zap } from 'lucide-react'
import { useRealtime } from '@/hooks/useRealtime'

interface LiveStatusBarProps { pocketId?: string }

export function LiveStatusBar({ pocketId }: LiveStatusBarProps) {
  const { connected, lastEvent } = useRealtime({ pocketId })

  const prices = lastEvent?.type === 'price_update' ? (lastEvent.payload as any).prices : null
  const fee    = lastEvent?.type === 'fee_update'   ? (lastEvent.payload as any).fee    : null

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-500">
      <div className={`flex items-center gap-1.5 ${connected ? 'text-green-400' : 'text-zinc-600'}`}>
        {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
        {connected ? 'Live' : 'Offline'}
      </div>

      {prices?.SOL && (
        <span>SOL <span className="text-zinc-300">${prices.SOL.toFixed(2)}</span></span>
      )}
      {prices?.BONK && (
        <span>BONK <span className="text-zinc-300">${prices.BONK.toFixed(6)}</span></span>
      )}

      {fee && (
        <div className="flex items-center gap-1 ml-auto">
          <Zap size={10} className={fee.congestion === 'low' ? 'text-green-400' : fee.congestion === 'medium' ? 'text-yellow-400' : 'text-red-400'} />
          <span>{fee.totalFeeSol} SOL/tx</span>
          <span className={`ml-1 ${fee.congestion === 'low' ? 'text-green-400' : fee.congestion === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
            {fee.congestion}
          </span>
        </div>
      )}
    </div>
  )
}
