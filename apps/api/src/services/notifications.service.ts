/**
 * NotificationsService — Expo push notifications for the mobile app.
 * Stores push tokens per user, sends via Expo Push API.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// In-memory store — add to DB in production
const pushTokens = new Map<string, string[]>()  // userId → tokens[]

export interface PushMessage {
  title:    string
  body:     string
  data?:    Record<string, unknown>
  sound?:   'default' | null
  badge?:   number
}

export class NotificationsService {
  registerToken(userId: string, expoPushToken: string): void {
    const existing = pushTokens.get(userId) ?? []
    if (!existing.includes(expoPushToken)) {
      pushTokens.set(userId, [...existing, expoPushToken])
    }
  }

  removeToken(userId: string, expoPushToken: string): void {
    const existing = pushTokens.get(userId) ?? []
    pushTokens.set(userId, existing.filter((t) => t !== expoPushToken))
  }

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const tokens = pushTokens.get(userId) ?? []
    if (tokens.length === 0) return
    await this.sendBatch(tokens, message)
  }

  async sendBatch(tokens: string[], message: PushMessage): Promise<void> {
    const messages = tokens.map((to) => ({
      to,
      title:  message.title,
      body:   message.body,
      data:   message.data ?? {},
      sound:  message.sound ?? 'default',
      badge:  message.badge,
    }))

    // Expo recommends batches of ≤100
    const chunks: typeof messages[] = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

    for (const chunk of chunks) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          console.error('[push] Expo API error:', await res.text())
        }
      } catch (err) {
        console.error('[push] send error:', err)
      }
    }
  }

  // ── Typed notification helpers ─────────────────────────────────────────────

  async notifyTxConfirmed(userId: string, token: string, amount: string, chain: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Transaction confirmed',
      body:  `${amount} ${token} confirmed on ${chain}`,
      data:  { type: 'tx_confirmed', token, amount, chain },
    })
  }

  async notifyLowBalance(userId: string, token: string, balanceSol: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Low balance alert',
      body:  `Your ${token} balance is low: ${balanceSol} ${token}`,
      data:  { type: 'low_balance', token },
    })
  }

  async notifyPriceAlert(userId: string, token: string, direction: string, priceUsd: number): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Price alert triggered',
      body:  `${token} is now ${direction} $${priceUsd.toFixed(4)}`,
      data:  { type: 'price_alert', token, direction, priceUsd },
    })
  }
}

export const notificationsService = new NotificationsService()
