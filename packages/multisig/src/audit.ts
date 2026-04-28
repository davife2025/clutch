import type { AuditEntry, AuditAction } from './types.js'

export function createAuditEntry(params: {
  teamPocketId: string
  action:       AuditAction
  actorId:      string
  actorEmail:   string
  description:  string
  metadata?:    Record<string, unknown>
}): Omit<AuditEntry, 'id'> {
  return { ...params, ts: new Date() }
}

export function formatAuditDescription(action: AuditAction, meta: Record<string, unknown> = {}): string {
  switch (action) {
    case 'pocket_created':    return `Team pocket created`
    case 'member_added':      return `${meta.email} added as ${meta.role}`
    case 'member_removed':    return `${meta.email} removed from pocket`
    case 'proposal_created':  return `Proposal "${meta.title}" created`
    case 'proposal_approved': return `Proposal approved by ${meta.email}`
    case 'proposal_rejected': return `Proposal rejected by ${meta.email}`
    case 'proposal_executed': return `Proposal executed — tx ${String(meta.txHash ?? '').slice(0, 12)}...`
    case 'threshold_changed': return `Threshold changed to ${meta.threshold}-of-N`
    case 'limit_changed':     return `Spending limit for ${meta.email} set to $${meta.limitUsd ?? 'unlimited'}`
    case 'wallet_added':      return `Wallet ${String(meta.address ?? '').slice(0, 8)}... added`
    case 'wallet_removed':    return `Wallet removed`
    default:                  return String(action)
  }
}
