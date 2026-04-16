'use client'
import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { TransactionList } from '@/components/pocket/TransactionList'
import { Spinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'

export default function ActivityPage() {
  const [txns, setTxns]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const pocketsData = await api.getPockets()
        const all: any[] = []
        await Promise.allSettled(
          pocketsData.pockets.map(async (p: any) => {
            const t = await api.getTransactions(p.id)
            all.push(...t.transactions)
          })
        )
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setTxns(all)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <TopBar title="Activity" />
      {loading
        ? <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
        : <TransactionList transactions={txns} />
      }
    </div>
  )
}
