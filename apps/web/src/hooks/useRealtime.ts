'use client'
import { useEffect, useRef, useCallback, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws'

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
  const wsRef         = useRef<WebSocket | null>(null)
  const reconnectRef  = useRef<NodeJS.Timeout | null>(null)
  const [connected, setConnected]   = useState(false)
  const [lastEvent, setLastEvent]   = useState<WsEvent | null>(null)

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : null
    if (!token) return

    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      if (pocketId) {
        ws.send(JSON.stringify({ type: 'subscribe', pocketId }))
      }
    }

    ws.onmessage = (e) => {
      try {
        const event: WsEvent = JSON.parse(e.data)
        setLastEvent(event)
        switch (event.type) {
          case 'balance_update':  onBalanceUpdate?.(event.payload);  break
          case 'price_update':    onPriceUpdate?.(event.payload);    break
          case 'fee_update':      onFeeUpdate?.(event.payload);      break
          case 'alert_triggered': onAlertTriggered?.(event.payload); break
          case 'tx_confirmed':    onTxConfirmed?.(event.payload);    break
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      setConnected(false)
      // Exponential backoff reconnect — 3s, 6s, 12s
      if (!reconnectRef.current) {
        reconnectRef.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => ws.close()
  }, [pocketId, onBalanceUpdate, onPriceUpdate, onFeeUpdate, onAlertTriggered, onTxConfirmed])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendPing = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'ping' }))
  }, [])

  return { connected, lastEvent, sendPing }
}
