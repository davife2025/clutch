import { useEffect, useRef, useCallback, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { getToken } from '../lib/api'

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws'

export type WsEventType = 'balance_update' | 'price_update' | 'fee_update' | 'alert_triggered' | 'tx_confirmed' | 'subscribed' | 'error'

export interface WsEvent<T = unknown> {
  type:    WsEventType
  payload: T
  ts:      number
}

interface UseRealtimeOptions {
  pocketId?:         string
  onBalanceUpdate?:  (payload: any) => void
  onPriceUpdate?:    (payload: any) => void
  onFeeUpdate?:      (payload: any) => void
  onAlertTriggered?: (payload: any) => void
  onTxConfirmed?:    (payload: any) => void
}

export function useRealtime({
  pocketId,
  onBalanceUpdate,
  onPriceUpdate,
  onFeeUpdate,
  onAlertTriggered,
  onTxConfirmed,
}: UseRealtimeOptions) {
  const wsRef        = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)
  const [prices, setPrices]       = useState<Record<string, number>>({})
  const [fee, setFee]             = useState<any>(null)

  const connect = useCallback(async () => {
    const token = await getToken()
    if (!token) return

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      if (pocketId) ws.send(JSON.stringify({ type: 'subscribe', pocketId }))
    }

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data)
        switch (event.type) {
          case 'balance_update':
            onBalanceUpdate?.(event.payload)
            break
          case 'price_update':
            setPrices((event.payload as any).prices ?? {})
            onPriceUpdate?.(event.payload)
            break
          case 'fee_update':
            setFee((event.payload as any).fee)
            onFeeUpdate?.(event.payload)
            break
          case 'alert_triggered':
            onAlertTriggered?.(event.payload)
            break
          case 'tx_confirmed':
            onTxConfirmed?.(event.payload)
            break
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      setConnected(false)
      if (!reconnectRef.current) {
        reconnectRef.current = setTimeout(connect, 4000)
      }
    }

    ws.onerror = () => ws.close()
  }, [pocketId])

  // Connect on mount, disconnect when app goes background
  useEffect(() => {
    connect()

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        wsRef.current?.close()
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      } else if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState > 1) connect()
      }
    })

    return () => {
      sub.remove()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected, prices, fee }
}
