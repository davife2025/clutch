'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'
import { logoutUser } from '@/lib/auth'

export default function SettingsPage() {
  const [health, setHealth]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.chainHealth()
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <TopBar title="Settings" />

      <div className="max-w-lg space-y-6">
        {/* Account */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-sm text-zinc-400">Session</span>
              <button onClick={logoutUser} className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors">
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Chain health */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-4">Chain connectivity</h2>
          {loading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : health ? (
            <div className="space-y-2">
              {Object.entries(health.chains as Record<string, boolean>).map(([chain, ok]) => (
                <div key={chain} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300 capitalize">{chain}</span>
                  <span className={`text-xs font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>
                    {ok ? '● Online' : '● Offline'}
                  </span>
                </div>
              ))}
              <p className="text-xs text-zinc-600 pt-2">
                {health.healthy}/{health.total} chains reachable
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Could not reach API</p>
          )}
        </div>

        {/* About */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-4">About</h2>
          <div className="space-y-2 text-sm text-zinc-500">
            <div className="flex justify-between"><span>Version</span><span>0.4.0</span></div>
            <div className="flex justify-between"><span>Sessions built</span><span>1 – 5</span></div>
            <div className="flex justify-between"><span>Next</span><span>Session 6 — AI agent</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
