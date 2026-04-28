'use client'
import { useEffect, useRef, useCallback, useState } from 'react'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
  .replace(/^http/, 'ws')

export type SocketEvent =
  | { type: 'connected';      clientId: string }
  | { type: 'balance_update'; pocketId: string; totalUsd: number; updatedAt: string }
  | { type: 'price_alert';    alert: any; currentPrice: number }
  | { type: 'tx_confirmed';   txId: string; txHash: string; pocketId: string }
  | { type: 'ping' }

interface UseClutchSocketOptions {
  onEvent?: (event: SocketEvent) => void
  onBalanceUpdate?: (pocketId: string, totalUsd: number) => void
  onPriceAlert?: (alert: any, currentPrice: number) => void
  onTxConfirmed?: (txId: string, txHash: string, pocketId: string) => void
}

export function useClutchSocket(options: UseClutchSocketOptions = {}) {
  const wsRef        = useRef<WebSocket | null>(null)
  const [connected, setConnected]   = useState(false)
  const [lastEvent, setLastEvent]   = useState<SocketEvent | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    const token = localStorage.getItem('clutch_token')
    if (!token) return

    const ws = new WebSocket(`${API_URL}/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }

    ws.onmessage = (msg) => {
      try {
        const event: SocketEvent = JSON.parse(msg.data)
        if (event.type === 'ping') { ws.send('pong'); return }

        setLastEvent(event)
        options.onEvent?.(event)

        if (event.type === 'balance_update')
          options.onBalanceUpdate?.(event.pocketId, event.totalUsd)
        if (event.type === 'price_alert')
          options.onPriceAlert?.(event.alert, event.currentPrice)
        if (event.type === 'tx_confirmed')
          options.onTxConfirmed?.(event.txId, event.txHash, event.pocketId)
      } catch {}
    }

    ws.onerror = () => setConnected(false)

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Auto-reconnect after 5s
      reconnectRef.current = setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, lastEvent }
}
