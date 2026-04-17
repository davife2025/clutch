'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { AgentChat } from '@/components/agent/AgentChat'
import { AgentAnalysis } from '@/components/agent/AgentAnalysis'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'

export default function AgentPage() {
  const [pockets, setPockets]         = useState<any[]>([])
  const [selectedPocket, setSelected] = useState<string>('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.getPockets().then((d) => {
      setPockets(d.pockets)
      if (d.pockets.length > 0) setSelected(d.pockets[0].id)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>

  return (
    <div>
      <TopBar title="AI Agent" />

      {pockets.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">Create a pocket first to use the AI agent.</div>
      ) : (
        <div>
          {/* Pocket selector */}
          {pockets.length > 1 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-zinc-400">Pocket:</span>
              <div className="flex gap-2">
                {pockets.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPocket === p.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPocket && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AgentChat pocketId={selectedPocket} />
              <AgentAnalysis pocketId={selectedPocket} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
