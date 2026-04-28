/**
 * Clutch React hooks.
 * Wrap ClutchClient with React state management + loading / error patterns.
 *
 * Usage:
 *   const { pockets, loading, error, refresh } = usePockets(client)
 *   const { totalUsd, balances, sync } = useBalances(client, pocketId)
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import type { ClutchClient } from './index.js'

// ── Context ───────────────────────────────────────────────────────────────────

export const ClutchContext = createContext<ClutchClient | null>(null)

export function useClutchClient(): ClutchClient {
  const client = useContext(ClutchContext)
  if (!client) throw new Error('useClutchClient must be used within a ClutchProvider')
  return client
}

// ── Generic async hook ────────────────────────────────────────────────────────

export function useAsync<T>(
  fn:   () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const mountedRef            = useRef(true)

  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const result = await fn()
      if (mountedRef.current) setData(result)
    } catch (err: any) {
      if (mountedRef.current) setError(err.message ?? 'An error occurred')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, deps)  // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => { mountedRef.current = false }
  }, [run])

  return { data, loading, error, refresh: run }
}

// ── Pocket hooks ──────────────────────────────────────────────────────────────

export function usePockets(client: ClutchClient) {
  return useAsync(() => client.pockets.list().then(r => r.pockets), [client])
}

export function usePocket(client: ClutchClient, pocketId: string) {
  return useAsync(() => client.pockets.get(pocketId).then(r => r.pocket), [client, pocketId])
}

// ── Balance hooks ─────────────────────────────────────────────────────────────

export function useBalances(client: ClutchClient, pocketId: string) {
  const { data, loading, error, refresh } = useAsync(
    () => client.balances.get(pocketId),
    [client, pocketId]
  )

  const sync = useCallback(async () => {
    await client.balances.sync(pocketId)
    setTimeout(refresh, 3000)
  }, [client, pocketId, refresh])

  return {
    totalUsd:  data?.totalUsd ?? 0,
    wallets:   data?.wallets  ?? [],
    loading, error, refresh, sync,
  }
}

// ── Native balance hook ───────────────────────────────────────────────────────

export function useNativeBalance(client: ClutchClient, pocketId: string) {
  return useAsync(
    () => client.pockets.nativeBalance(pocketId),
    [client, pocketId]
  )
}

// ── Transaction hook ──────────────────────────────────────────────────────────

export function useTransactions(client: ClutchClient, pocketId: string) {
  const { data, loading, error, refresh } = useAsync(
    () => client.transactions.list(pocketId).then(r => r.transactions),
    [client, pocketId]
  )
  return { transactions: data ?? [], loading, error, refresh }
}

// ── Agent hook ────────────────────────────────────────────────────────────────

export function useAgent(client: ClutchClient) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis,  setAnalysis]  = useState<any>(null)
  const [error,     setError]     = useState<string | null>(null)

  const analyze = useCallback(async (pocketId: string) => {
    setAnalyzing(true); setError(null)
    try {
      const r = await client.agent.analyze(pocketId)
      setAnalysis(r.analysis)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }, [client])

  return { analysis, analyzing, error, analyze }
}

// ── DeFi hooks ────────────────────────────────────────────────────────────────

export function useYield(client: ClutchClient, pocketId?: string) {
  return useAsync(
    () => client.defi.getYield(pocketId).then(r => r.opportunities),
    [client, pocketId]
  )
}

export function useTokenMetrics(client: ClutchClient, tokens: string[]) {
  return useAsync(
    () => client.defi.getMetrics(tokens).then(r => r.metrics),
    [client, tokens.join(',')]
  )
}

// ── NFT hook ──────────────────────────────────────────────────────────────────

export function useNfts(client: ClutchClient, pocketId: string) {
  const { data, loading, error, refresh } = useAsync(
    () => client.nfts.list(pocketId),
    [client, pocketId]
  )

  const sync = useCallback(async () => {
    await client.nfts.sync(pocketId)
    setTimeout(refresh, 5000)
  }, [client, pocketId, refresh])

  return {
    nfts:             data?.nfts ?? [],
    totalItems:       data?.totalItems ?? 0,
    estimatedValueSOL: data?.estimatedValueSOL ?? 0,
    loading, error, refresh, sync,
  }
}

// ── Analytics hook ────────────────────────────────────────────────────────────

export function useAnalytics(client: ClutchClient, pocketId: string) {
  return useAsync(
    () => client.analytics.report(pocketId).then(r => r.report),
    [client, pocketId]
  )
}

// ── Staking hook ──────────────────────────────────────────────────────────────

export function useStaking(client: ClutchClient, pocketId: string) {
  return useAsync(
    () => client.staking.portfolio(pocketId),
    [client, pocketId]
  )
}
