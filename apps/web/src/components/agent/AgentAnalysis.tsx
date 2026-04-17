'use client'
import { useState } from 'react'
import { Sparkles, AlertTriangle, Info, Zap, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface AgentAnalysisProps { pocketId: string }

const SEVERITY_STYLES: Record<string, string> = {
  info:     'bg-blue-900/30 border-blue-800 text-blue-300',
  warning:  'bg-yellow-900/30 border-yellow-800 text-yellow-300',
  critical: 'bg-red-900/30 border-red-800 text-red-300',
}

const SEVERITY_ICONS: Record<string, any> = {
  info:     Info,
  warning:  AlertTriangle,
  critical: AlertTriangle,
}

export function AgentAnalysis({ pocketId }: AgentAnalysisProps) {
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function runAnalysis() {
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/agent/analyze/${pocketId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('clutch_token')}`,
          },
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message)
      setAnalysis(json.data.analysis)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-green-400" />
          <span className="font-semibold text-white">AI Analysis</span>
        </div>
        <button onClick={runAnalysis} disabled={loading}
          className="btn-ghost flex items-center gap-1.5 py-1.5 px-3 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analysing...' : analysis ? 'Re-analyse' : 'Analyse pocket'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}

      {!analysis && !loading && (
        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm">Click "Analyse pocket" to get AI-powered insights about your wallets.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Spinner />
          <span className="text-zinc-400 text-sm">Claude is analysing your portfolio...</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Health score */}
          <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-xl">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{analysis.healthScore}</p>
              <p className="text-xs text-zinc-500">/ 100</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-1">Portfolio health</p>
              <div className="w-40 h-2 bg-zinc-700 rounded-full">
                <div
                  className={cn('h-2 rounded-full transition-all', analysis.healthScore >= 70 ? 'bg-green-500' : analysis.healthScore >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
                  style={{ width: `${analysis.healthScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-zinc-300 leading-relaxed">{analysis.summary}</p>

          {/* Insights */}
          {analysis.insights?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Insights</p>
              {analysis.insights.map((insight: any, i: number) => {
                const Icon = SEVERITY_ICONS[insight.severity] ?? Info
                return (
                  <div key={i} className={cn('border rounded-xl p-3.5', SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info)}>
                    <div className="flex items-start gap-2.5">
                      <Icon size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{insight.title}</p>
                        <p className="text-xs mt-0.5 opacity-80">{insight.message}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Suggested actions */}
          {analysis.suggestedActions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Suggested actions</p>
              <ul className="space-y-1.5">
                {analysis.suggestedActions.map((action: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Zap size={12} className="text-green-400 shrink-0 mt-1" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
