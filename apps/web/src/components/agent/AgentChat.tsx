'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Message { role: 'user' | 'assistant'; content: string }

interface AgentChatProps { pocketId: string }

export function AgentChat({ pocketId }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your Clutch AI agent. I can analyse your wallets, suggest optimisations, and execute payments. What would you like to do?" }
  ])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const token = localStorage.getItem('clutch_token')
      const res = await fetch(`${API_URL}/agent/chat/${pocketId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(Boolean)
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (data) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + data,
                }
                return updated
              })
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Check that ANTHROPIC_API_KEY is set.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="card flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Sparkles size={14} className="text-green-400" />
        </div>
        <span className="font-semibold text-white text-sm">Clutch AI Agent</span>
        <span className="badge bg-green-900 text-green-300 ml-auto">Claude</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
              msg.role === 'user' ? 'bg-zinc-700' : 'bg-green-500/10'
            )}>
              {msg.role === 'user'
                ? <User size={13} className="text-zinc-300" />
                : <Bot size={13} className="text-green-400" />
              }
            </div>
            <div className={cn(
              'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-zinc-700 text-white rounded-tr-sm'
                : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
            )}>
              {msg.content || (streaming && i === messages.length - 1 ? <Spinner className="w-4 h-4" /> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            className="input text-sm py-2.5"
            placeholder="Ask about your wallets, request a payment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            disabled={streaming}
          />
          <button onClick={sendMessage} disabled={streaming || !input.trim()}
            className="btn-primary px-3 py-2.5 shrink-0 disabled:opacity-40">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
