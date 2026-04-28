/**
 * Clutch Extension — background service worker (Manifest V3).
 *
 * Responsibilities:
 *   - Persist wallet state in chrome.storage.local
 *   - Route messages between content script ↔ popup ↔ background
 *   - Handle dApp signing requests (queue → popup approval → response)
 *   - Periodic balance refresh alarm
 *   - Push notification delivery
 */

// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE = {
  TOKEN:       'clutch_token',
  WALLETS:     'clutch_wallets',
  BALANCES:    'clutch_balances',
  PENDING:     'clutch_pending_requests',
  SETTINGS:    'clutch_settings',
  LAST_SYNCED: 'clutch_last_synced',
}

// ── Message types ─────────────────────────────────────────────────────────────
export type MsgType =
  | 'CONNECT_REQUEST'       // dApp → content → background
  | 'CONNECT_RESPONSE'      // background → content → dApp
  | 'SIGN_TX_REQUEST'       // dApp → content → background
  | 'SIGN_TX_RESPONSE'      // background → content → dApp
  | 'SIGN_MSG_REQUEST'
  | 'SIGN_MSG_RESPONSE'
  | 'GET_ACCOUNTS'          // dApp → background
  | 'GET_ACCOUNTS_RESPONSE'
  | 'POPUP_APPROVE'         // popup → background
  | 'POPUP_REJECT'
  | 'BALANCE_UPDATE'        // background → popup
  | 'PRICE_UPDATE'
  | 'SYNC_BALANCES'         // popup → background

interface PendingRequest {
  id:          string
  type:        MsgType
  payload:     unknown
  origin:      string
  tabId:       number
  requestedAt: number
}

// ── State ─────────────────────────────────────────────────────────────────────

const pendingRequests = new Map<string, PendingRequest>()

// ── Lifecycle ─────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      [STORAGE.SETTINGS]: {
        autoApproveUnderUsd: 0,
        notifications: true,
        theme: 'dark',
        apiUrl: 'https://api.clutch.app',
      },
      [STORAGE.PENDING]: [],
    })
    console.log('[clutch] Extension installed')
  }
})

// Periodic balance sync alarm — every 5 minutes
chrome.alarms.create('balance-sync', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'balance-sync') {
    await syncBalances()
  }
})

// ── Message routing ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse)
  return true  // keep channel open for async response
})

async function handleMessage(
  message:      { type: MsgType; payload?: any; requestId?: string },
  sender:       chrome.runtime.MessageSender,
  sendResponse: (r: any) => void,
) {
  const { type, payload, requestId } = message

  switch (type) {

    // ── dApp requests ────────────────────────────────────────────────────────

    case 'GET_ACCOUNTS': {
      const { wallets } = await chrome.storage.local.get(STORAGE.WALLETS)
      const accounts = (wallets ?? []).map((w: any) => w.address)
      sendResponse({ type: 'GET_ACCOUNTS_RESPONSE', accounts })
      break
    }

    case 'CONNECT_REQUEST': {
      const reqId = crypto.randomUUID()
      const req: PendingRequest = {
        id:          reqId,
        type:        'CONNECT_REQUEST',
        payload:     { ...payload, origin: sender.origin },
        origin:      sender.origin ?? '',
        tabId:       sender.tab?.id ?? 0,
        requestedAt: Date.now(),
      }
      pendingRequests.set(reqId, req)
      await persistPending()

      // Open popup for user approval
      await chrome.action.openPopup()
      sendResponse({ requestId: reqId, pending: true })
      break
    }

    case 'SIGN_TX_REQUEST':
    case 'SIGN_MSG_REQUEST': {
      const reqId = crypto.randomUUID()
      const req: PendingRequest = {
        id:          reqId,
        type,
        payload:     { ...payload, origin: sender.origin },
        origin:      sender.origin ?? '',
        tabId:       sender.tab?.id ?? 0,
        requestedAt: Date.now(),
      }
      pendingRequests.set(reqId, req)
      await persistPending()

      // Show notification badge
      chrome.action.setBadgeText({ text: String(pendingRequests.size) })
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })

      await chrome.action.openPopup()
      sendResponse({ requestId: reqId, pending: true })
      break
    }

    // ── Popup responses ──────────────────────────────────────────────────────

    case 'POPUP_APPROVE': {
      const req = pendingRequests.get(requestId ?? '')
      if (!req) { sendResponse({ error: 'Request not found' }); break }

      pendingRequests.delete(req.id)
      await persistPending()
      updateBadge()

      // Forward approval to the originating tab
      if (req.tabId) {
        chrome.tabs.sendMessage(req.tabId, {
          type:      req.type.replace('_REQUEST', '_RESPONSE'),
          requestId: req.id,
          result:    payload,
          approved:  true,
        })
      }

      sendResponse({ ok: true })
      break
    }

    case 'POPUP_REJECT': {
      const req = pendingRequests.get(requestId ?? '')
      if (!req) { sendResponse({ error: 'Request not found' }); break }

      pendingRequests.delete(req.id)
      await persistPending()
      updateBadge()

      if (req.tabId) {
        chrome.tabs.sendMessage(req.tabId, {
          type:      req.type.replace('_REQUEST', '_RESPONSE'),
          requestId: req.id,
          error:     'User rejected',
          approved:  false,
        })
      }

      sendResponse({ ok: true })
      break
    }

    // ── Popup actions ────────────────────────────────────────────────────────

    case 'SYNC_BALANCES': {
      await syncBalances()
      sendResponse({ ok: true })
      break
    }

    default:
      sendResponse({ error: `Unknown message type: ${type}` })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function persistPending(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE.PENDING]: [...pendingRequests.values()],
  })
}

function updateBadge(): void {
  const count = pendingRequests.size
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
}

async function syncBalances(): Promise<void> {
  const { clutch_token, clutch_settings } = await chrome.storage.local.get([
    STORAGE.TOKEN, STORAGE.SETTINGS,
  ])
  if (!clutch_token) return

  const apiUrl = clutch_settings?.apiUrl ?? 'https://api.clutch.app'

  try {
    const pocketsRes = await fetch(`${apiUrl}/pockets`, {
      headers: { Authorization: `Bearer ${clutch_token}` },
    })
    if (!pocketsRes.ok) return

    const { data } = await pocketsRes.json()
    const pockets  = data?.pockets ?? []

    const balanceMap: Record<string, any> = {}
    await Promise.allSettled(
      pockets.map(async (p: any) => {
        const res = await fetch(`${apiUrl}/balances/${p.id}`, {
          headers: { Authorization: `Bearer ${clutch_token}` },
        })
        if (res.ok) {
          const b = await res.json()
          balanceMap[p.id] = b.data
        }
      })
    )

    await chrome.storage.local.set({
      [STORAGE.BALANCES]:    balanceMap,
      [STORAGE.LAST_SYNCED]: Date.now(),
    })

    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'BALANCE_UPDATE', balances: balanceMap }).catch(() => {})
  } catch (err) {
    console.error('[clutch] balance sync failed:', err)
  }
}
