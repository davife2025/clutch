import React, { useState, useEffect } from 'react'

const API_URL_KEY = 'clutch_settings'
const TOKEN_KEY   = 'clutch_token'

// ── Types ─────────────────────────────────────────────────────────────────────
interface StoredState {
  token:        string | null
  balances:     Record<string, any>
  pending:      any[]
  settings:     { apiUrl: string; notifications: boolean }
  lastSynced:   number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useExtStorage(): [StoredState, boolean] {
  const [state, setState] = useState<StoredState>({
    token: null, balances: {}, pending: [], settings: { apiUrl: 'https://api.clutch.app', notifications: true }, lastSynced: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.storage.local.get(null, (all) => {
      setState({
        token:      all.clutch_token      ?? null,
        balances:   all.clutch_balances   ?? {},
        pending:    all.clutch_pending_requests ?? [],
        settings:   all.clutch_settings   ?? { apiUrl: 'https://api.clutch.app', notifications: true },
        lastSynced: all.clutch_last_synced ?? null,
      })
      setLoading(false)
    })

    // Listen for background updates
    const handler = (msg: any) => {
      if (msg.type === 'BALANCE_UPDATE') {
        setState(prev => ({ ...prev, balances: msg.balances }))
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  return [state, loading]
}

// ── Screens ───────────────────────────────────────────────────────────────────

function LoginScreen({ apiUrl }: { apiUrl: string }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Login failed'); return }
      await chrome.storage.local.set({ clutch_token: json.data.token })
      chrome.runtime.sendMessage({ type: 'SYNC_BALANCES' })
      window.location.reload()
    } finally { setLoading(false) }
  }

  return (
    <div style={styles.screen}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🫙</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Clutch</div>
        <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Your Solana wallet pocket</div>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <input style={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={styles.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleLogin() }} />
      <button style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }} onClick={handleLogin} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </div>
  )
}

function PendingScreen({ requests, onApprove, onReject }: { requests: any[]; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const req = requests[0]
  if (!req) return null

  const typeLabel = req.type === 'CONNECT_REQUEST' ? 'Connection request'
    : req.type === 'SIGN_TX_REQUEST'  ? 'Sign transaction'
    : 'Sign message'

  return (
    <div style={styles.screen}>
      <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>
        {req.type === 'CONNECT_REQUEST' ? '🔗' : '✍️'}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 4 }}>{typeLabel}</div>
      <div style={{ fontSize: 12, color: '#71717a', textAlign: 'center', marginBottom: 16 }}>
        {req.origin ?? 'Unknown origin'}
      </div>
      {requests.length > 1 && (
        <div style={{ fontSize: 11, color: '#52525b', textAlign: 'center', marginBottom: 12 }}>
          {requests.length - 1} more request{requests.length > 2 ? 's' : ''} queued
        </div>
      )}
      <div style={{ background: '#18181b', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#a1a1aa' }}>
        <div style={{ marginBottom: 4 }}><b style={{ color: '#fff' }}>Origin:</b> {req.origin}</div>
        <div><b style={{ color: '#fff' }}>Type:</b> {req.type.replace(/_/g, ' ').toLowerCase()}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...styles.btnGhost, flex: 1 }} onClick={() => onReject(req.id)}>Reject</button>
        <button style={{ ...styles.btn, flex: 1 }} onClick={() => onApprove(req.id)}>Approve</button>
      </div>
    </div>
  )
}

function WalletScreen({ state, onSync }: { state: StoredState; onSync: () => void }) {
  const totalUsd = Object.values(state.balances).reduce((s: number, b: any) => s + (b?.totalUsd ?? 0), 0)
  const allWallets = Object.values(state.balances).flatMap((b: any) => b?.wallets ?? [])
  const lastSync = state.lastSynced ? new Date(state.lastSynced).toLocaleTimeString() : 'Never'

  async function openDashboard() {
    chrome.tabs.create({ url: `${state.settings.apiUrl.replace('3001', '3000')}/dashboard` })
  }

  async function logout() {
    await chrome.storage.local.remove(['clutch_token', 'clutch_balances'])
    window.location.reload()
  }

  return (
    <div style={styles.screen}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🫙</span>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Clutch</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={styles.iconBtn} onClick={onSync} title="Sync">↻</button>
          <button style={styles.iconBtn} onClick={openDashboard} title="Dashboard">↗</button>
          <button style={{ ...styles.iconBtn, color: '#71717a' }} onClick={logout} title="Sign out">⎋</button>
        </div>
      </div>

      {/* Total */}
      <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
          ${totalUsd.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>Last synced: {lastSync}</div>
      </div>

      {/* Wallets */}
      {allWallets.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#52525b', fontSize: 13, padding: '16px 0' }}>
          No wallets yet — open the dashboard to add one
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allWallets.slice(0, 4).map((w: any, i: number) => {
            const total = (w.balances ?? []).reduce((s: number, b: any) => s + parseFloat(b.usdValue ?? '0'), 0)
            return (
              <div key={i} style={{ background: '#18181b', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 2 }}>{w.chain ?? 'solana'}</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>
                    {w.address ? `${w.address.slice(0, 6)}...${w.address.slice(-4)}` : '—'}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>${total.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Open dashboard */}
      <button style={{ ...styles.btn, marginTop: 16, width: '100%' }} onClick={openDashboard}>
        Open Clutch dashboard ↗
      </button>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Popup() {
  const [state, loading] = useExtStorage()

  function approve(requestId: string) {
    chrome.runtime.sendMessage({ type: 'POPUP_APPROVE', requestId, payload: { approved: true } })
    window.location.reload()
  }

  function reject(requestId: string) {
    chrome.runtime.sendMessage({ type: 'POPUP_REJECT', requestId })
    window.location.reload()
  }

  function sync() {
    chrome.runtime.sendMessage({ type: 'SYNC_BALANCES' })
  }

  if (loading) return <div style={{ ...styles.container, justifyContent: 'center' }}><div style={{ color: '#52525b' }}>Loading...</div></div>

  return (
    <div style={styles.container}>
      {!state.token
        ? <LoginScreen apiUrl={state.settings.apiUrl} />
        : state.pending.length > 0
        ? <PendingScreen requests={state.pending} onApprove={approve} onReject={reject} />
        : <WalletScreen state={state} onSync={sync} />
      }
    </div>
  )
}

// ── Inline styles (no Tailwind in extension popup) ────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { width: 360, minHeight: 480, background: '#09090b', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' },
  screen:    { flex: 1, padding: 20, display: 'flex', flexDirection: 'column' },
  input:     { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 14, marginBottom: 10, outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn:       { background: '#22c55e', border: 'none', borderRadius: 12, padding: '12px 16px', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', boxSizing: 'border-box' },
  btnGhost:  { background: 'transparent', border: '1px solid #3f3f46', borderRadius: 12, padding: '12px 16px', color: '#a1a1aa', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' },
  error:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 12 },
  iconBtn:   { background: '#18181b', border: '1px solid #27272a', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#a1a1aa', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
