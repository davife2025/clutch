/**
 * AlertsService — in-memory price alerts (persisted to DB via alerts table in Session 11).
 * Users set a target price for a token; the service fires when crossed.
 */
import { priceService } from '../price.service.js'

export type AlertDirection = 'above' | 'below'

export interface PriceAlert {
  id:         string
  userId:     string
  token:      string
  targetUsd:  number
  direction:  AlertDirection
  triggered:  boolean
  createdAt:  Date
  triggeredAt?: Date
}

export interface AlertTrigger {
  alert:        PriceAlert
  currentPrice: number
}

// In-memory store — persisted to DB in Session 11 with the real-time layer
const alertStore = new Map<string, PriceAlert>()
let alertIdSeq = 1

export class AlertsService {
  addAlert(userId: string, token: string, targetUsd: number, direction: AlertDirection): PriceAlert {
    const alert: PriceAlert = {
      id:        String(alertIdSeq++),
      userId,
      token:     token.toUpperCase(),
      targetUsd,
      direction,
      triggered: false,
      createdAt: new Date(),
    }
    alertStore.set(alert.id, alert)
    return alert
  }

  getUserAlerts(userId: string): PriceAlert[] {
    return [...alertStore.values()].filter((a) => a.userId === userId && !a.triggered)
  }

  deleteAlert(id: string, userId: string): boolean {
    const alert = alertStore.get(id)
    if (!alert || alert.userId !== userId) return false
    alertStore.delete(id)
    return true
  }

  /**
   * Check all pending alerts against current prices.
   * Returns list of triggered alerts.
   * Called by the real-time worker every 60s in Session 11.
   */
  async checkAlerts(): Promise<AlertTrigger[]> {
    const pending  = [...alertStore.values()].filter((a) => !a.triggered)
    const tokens   = [...new Set(pending.map((a) => a.token))]
    const prices   = await priceService.getBatchPrices(tokens)
    const triggered: AlertTrigger[] = []

    for (const alert of pending) {
      const currentPrice = prices[alert.token]
      if (!currentPrice) continue

      const fired =
        (alert.direction === 'above' && currentPrice >= alert.targetUsd) ||
        (alert.direction === 'below' && currentPrice <= alert.targetUsd)

      if (fired) {
        alert.triggered   = true
        alert.triggeredAt = new Date()
        alertStore.set(alert.id, alert)
        triggered.push({ alert, currentPrice })
      }
    }

    return triggered
  }
}

export const alertsService = new AlertsService()
