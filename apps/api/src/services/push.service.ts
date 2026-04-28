/**
 * Push notification service.
 *
 * Supports:
 *   - Expo Push (mobile — iOS + Android via FCM/APNs)
 *   - Web Push (browser notifications via service worker)
 *
 * Expo Push API docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type NotificationCategory =
  | 'tx_confirmed'
  | 'tx_failed'
  | 'balance_low'
  | 'price_alert'
  | 'deposit_received'
  | 'payment_sent'
  | 'agent_action'

export interface PushToken {
  userId:    string
  token:     string               // Expo push token: ExponentPushToken[...]
  platform:  'ios' | 'android' | 'web'
  createdAt: Date
}

export interface PushNotification {
  to:       string                // Expo push token
  title:    string
  body:     string
  data?:    Record<string, unknown>
  sound?:   'default' | null
  badge?:   number
  category?: NotificationCategory
  priority?: 'default' | 'normal' | 'high'
}

export interface PushResult {
  status:  'ok' | 'error'
  id?:     string
  message?: string
  details?: unknown
}

// In-memory token store — replace with DB in production
const tokenStore = new Map<string, PushToken[]>()

export class PushNotificationService {

  // ── Token management ────────────────────────────────────────────────────────

  registerToken(userId: string, token: string, platform: PushToken['platform']): void {
    const existing = tokenStore.get(userId) ?? []
    const hasToken = existing.some((t) => t.token === token)
    if (!hasToken) {
      tokenStore.set(userId, [...existing, { userId, token, platform, createdAt: new Date() }])
    }
  }

  removeToken(userId: string, token: string): void {
    const existing = tokenStore.get(userId) ?? []
    tokenStore.set(userId, existing.filter((t) => t.token !== token))
  }

  getTokens(userId: string): PushToken[] {
    return tokenStore.get(userId) ?? []
  }

  // ── Send notifications ──────────────────────────────────────────────────────

  /**
   * Send a push notification to all of a user's devices.
   */
  async notifyUser(
    userId:  string,
    title:   string,
    body:    string,
    data?:   Record<string, unknown>,
    category?: NotificationCategory,
  ): Promise<PushResult[]> {
    const tokens = this.getTokens(userId)
    if (tokens.length === 0) return []

    const notifications: PushNotification[] = tokens
      .filter((t) => t.token.startsWith('ExponentPushToken'))
      .map((t) => ({
        to:       t.token,
        title,
        body,
        data,
        sound:    'default',
        priority: 'high',
        category,
      }))

    return this.sendBatch(notifications)
  }

  /**
   * Send a batch of push notifications via Expo.
   * Handles chunking (Expo limit: 100 per request).
   */
  async sendBatch(notifications: PushNotification[]): Promise<PushResult[]> {
    if (notifications.length === 0) return []

    const results: PushResult[] = []
    const chunks = chunkArray(notifications, 100)

    for (const chunk of chunks) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Accept':        'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body:   JSON.stringify(chunk),
          signal: AbortSignal.timeout(10_000),
        })

        if (!res.ok) {
          results.push({ status: 'error', message: `HTTP ${res.status}` })
          continue
        }

        const data = await res.json() as { data: Array<{ status: string; id?: string; message?: string; details?: unknown }> }
        for (const item of data.data) {
          results.push({
            status:  item.status === 'ok' ? 'ok' : 'error',
            id:      item.id,
            message: item.message,
            details: item.details,
          })
        }
      } catch (err) {
        results.push({ status: 'error', message: String(err) })
      }
    }

    return results
  }

  // ── Templated notifications ────────────────────────────────────────────────

  async notifyTxConfirmed(userId: string, txType: string, amount: string, token: string, chain: string): Promise<void> {
    const title  = `${capitalize(txType)} confirmed`
    const body   = `${amount} ${token} on ${capitalize(chain)}`
    await this.notifyUser(userId, title, body, { txType, amount, token, chain }, 'tx_confirmed')
  }

  async notifyTxFailed(userId: string, txType: string): Promise<void> {
    await this.notifyUser(userId, 'Transaction failed', `Your ${txType} failed. Tap to view.`, {}, 'tx_failed')
  }

  async notifyPriceAlert(userId: string, token: string, direction: string, price: number): Promise<void> {
    const body = `${token} is now ${direction} $${price.toFixed(2)}`
    await this.notifyUser(userId, 'Price alert triggered', body, { token, direction, price }, 'price_alert')
  }

  async notifyLowBalance(userId: string, token: string, amount: string): Promise<void> {
    const body = `Your ${token} balance is low (${amount})`
    await this.notifyUser(userId, 'Low balance', body, { token, amount }, 'balance_low')
  }

  async notifyAgentAction(userId: string, description: string): Promise<void> {
    await this.notifyUser(userId, 'Agent action', description, {}, 'agent_action')
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const pushService = new PushNotificationService()
