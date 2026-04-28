'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { Check, Zap, X } from 'lucide-react'
import { formatUsd } from '@/lib/utils'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
function authFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('clutch_token') : ''
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } }).then(r => r.json())
}

const PERIOD_LABELS: Record<string, string> = {
  daily: '/day', weekly: '/week', monthly: '/month', annual: '/year',
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-900 text-green-300',
  past_due:  'bg-red-900 text-red-300',
  cancelled: 'bg-zinc-800 text-zinc-400',
  trialing:  'bg-blue-900 text-blue-300',
  expired:   'bg-zinc-800 text-zinc-500',
}

export default function SubscriptionsPage() {
  const [plans, setPlans]   = useState<any[]>([])
  const [subs, setSubs]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [cancelling, setCancelling]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      authFetch('/subscriptions/plans').then(r => setPlans(r.data?.plans ?? [])),
      authFetch('/subscriptions').then(r => setSubs(r.data?.subscriptions ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  async function subscribe(planId: string) {
    const walletAddress = prompt('Enter your Solana wallet address to subscribe:')
    if (!walletAddress) return
    setSubscribing(planId)
    try {
      const r = await authFetch('/subscriptions/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId, payerAddress: walletAddress }),
      })
      if (r.error) { alert(r.error.message); return }
      const updated = await authFetch('/subscriptions')
      setSubs(updated.data?.subscriptions ?? [])
    } finally { setSubscribing(null) }
  }

  async function cancel(subId: string) {
    if (!confirm('Cancel at end of current period?')) return
    setCancelling(subId)
    try {
      await authFetch(`/subscriptions/${subId}/cancel`, { method: 'POST' })
      const updated = await authFetch('/subscriptions')
      setSubs(updated.data?.subscriptions ?? [])
    } finally { setCancelling(null) }
  }

  const activePlanIds = new Set(subs.filter(s => s.status === 'active').map((s: any) => s.planId))

  if (loading) return <div><TopBar title="Subscriptions" /><div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div></div>

  return (
    <div>
      <TopBar title="Subscriptions" />

      {/* Active subscriptions */}
      {subs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Active subscriptions</h2>
          <div className="space-y-3">
            {subs.map((s: any) => (
              <div key={s.id} className="card p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{s.plan?.name ?? 'Plan'}</span>
                    <span className={cn('badge', STATUS_STYLES[s.status] ?? STATUS_STYLES.active)}>{s.status}</span>
                    {s.cancelAtPeriodEnd && <span className="badge bg-yellow-900 text-yellow-300">cancels at period end</span>}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Renews {new Date(s.currentPeriodEnd).toLocaleDateString()} ·
                    Paying from {s.payerAddress.slice(0, 8)}...
                  </p>
                </div>
                {!s.cancelAtPeriodEnd && s.status === 'active' && (
                  <button className="btn-danger text-sm py-1.5 px-3" onClick={() => cancel(s.id)} disabled={cancelling === s.id}>
                    {cancelling === s.id ? '...' : 'Cancel'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="card p-10 text-center">
          <Zap size={32} className="text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No subscription plans available yet.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Available plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan: any) => {
              const isActive = activePlanIds.has(plan.id)
              return (
                <div key={plan.id} className={cn('card p-6 flex flex-col', isActive && 'border-green-800')}>
                  {isActive && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold mb-3">
                      <Check size={12} /> Current plan
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold text-white">{formatUsd(plan.priceUsd / 100)}</span>
                    <span className="text-zinc-500 text-sm">{PERIOD_LABELS[plan.billingPeriod] ?? ''}</span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">{plan.description}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {(plan.features ?? []).map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <Check size={13} className="text-green-400 shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-zinc-600 mb-3">Paid in {plan.token} on {plan.chain}</div>
                  <button
                    className={cn('btn-primary w-full', isActive && 'opacity-50 cursor-not-allowed')}
                    onClick={() => !isActive && subscribe(plan.id)}
                    disabled={isActive || subscribing === plan.id}>
                    {subscribing === plan.id ? 'Subscribing...' : isActive ? 'Subscribed' : 'Subscribe'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
