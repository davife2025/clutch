'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRealtime } from './useRealtime'
import { api } from '@/lib/api'

interface UseLiveBalancesResult {
  balances:   any | null
  totalUsd:   number
  prices:     Record<string, number>
  fee:        any | null
  syncing:    boolean
  connected:  boolean
  sync:       () => void
}

export function useLiveBalances(pocketId: string): UseLiveBalancesResult {
  const [balances, setBalances] = useState<any | null>(null)
  const [totalUsd, setTotalUsd] = useState(0)
  const [prices, setPrices]     = useState<Record<string, number>>({})
  const [fee, setFee]           = useState<any | null>(null)
  const [syncing, setSyncing]   = useState(false)

  // Initial fetch
  useEffect(() => {
    if (!pocketId) return
    api.getBalances(pocketId).then((b) => {
      setBalances(b)
      setTotalUsd(b.totalUsd ?? 0)
    }).catch(() => {})
  }, [pocketId])

  const sync = useCallback(async () => {
    if (!pocketId) return
    setSyncing(true)
    try {
      await api.syncBalances(pocketId)
      setTimeout(async () => {
        const b = await api.getBalances(pocketId)
        setBalances(b)
        setTotalUsd(b.totalUsd ?? 0)
        setSyncing(false)
      }, 2000)
    } catch {
      setSyncing(false)
    }
  }, [pocketId])

  // WebSocket live updates
  const { connected } = useRealtime({
    pocketId,
    onBalanceUpdate: (payload) => {
      if (payload.pocketId === pocketId) {
        setTotalUsd(payload.totalUsd)
        // Re-fetch full balances on update
        api.getBalances(pocketId).then(setBalances).catch(() => {})
      }
    },
    onPriceUpdate: (payload) => {
      setPrices(payload.prices ?? {})
    },
    onFeeUpdate: (payload) => {
      setFee(payload.fee)
    },
  })

  return { balances, totalUsd, prices, fee, syncing, connected, sync }
}
