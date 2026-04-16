import { db } from '../db/client.js'
import { pockets, transactions } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { ConnectorRegistry } from '@clutch/wallet-connectors'
import { ethToWei, weiToEth } from '@clutch/core'

export class FundsService {
  private registry: ConnectorRegistry

  constructor() {
    this.registry = new ConnectorRegistry({
      ethRpcUrl: process.env.ETH_RPC_URL,
    })
  }

  /**
   * Credit native balance — called after verifying an on-chain deposit.
   */
  async creditNativeBalance(pocketId: string, amountEth: string): Promise<void> {
    const amountWei = ethToWei(amountEth)
    const pocket = await db.query.pockets.findFirst({ where: eq(pockets.id, pocketId) })
    if (!pocket) throw new Error('Pocket not found')

    await db.update(pockets)
      .set({ nativeBalance: pocket.nativeBalance + amountWei, updatedAt: new Date() })
      .where(eq(pockets.id, pocketId))
  }

  /**
   * Debit native balance and broadcast on-chain withdrawal.
   * Returns the transaction hash.
   */
  async withdrawNative(
    pocketId: string,
    amountEth: string,
    toAddress: string,
    signingKey: string   // TODO: fetch from secure vault, not passed in directly
  ): Promise<string> {
    const amountWei = ethToWei(amountEth)
    const pocket = await db.query.pockets.findFirst({ where: eq(pockets.id, pocketId) })
    if (!pocket) throw new Error('Pocket not found')
    if (amountWei > pocket.nativeBalance) throw new Error('Insufficient balance')

    const connector = this.registry.getOrThrow('ethereum')

    // Deduct balance optimistically, revert on failure
    await db.update(pockets)
      .set({ nativeBalance: pocket.nativeBalance - amountWei, updatedAt: new Date() })
      .where(eq(pockets.id, pocketId))

    try {
      // @ts-expect-error — signing connector
      const receipt = await connector.sendTransaction(
        { to: toAddress, amount: amountWei, token: 'ETH', chain: 'ethereum' },
        signingKey
      )

      await db.update(transactions)
        .set({ status: 'confirmed', txHash: receipt.txHash, confirmedAt: new Date() })
        .where(eq(transactions.pocketId, pocketId))

      return receipt.txHash
    } catch (err) {
      // Revert on failure
      await db.update(pockets)
        .set({ nativeBalance: pocket.nativeBalance, updatedAt: new Date() })
        .where(eq(pockets.id, pocketId))
      throw err
    }
  }

  async getNativeBalance(pocketId: string): Promise<{ wei: bigint; eth: string }> {
    const pocket = await db.query.pockets.findFirst({ where: eq(pockets.id, pocketId) })
    if (!pocket) throw new Error('Pocket not found')
    return {
      wei: pocket.nativeBalance,
      eth: weiToEth(pocket.nativeBalance),
    }
  }
}

export const fundsService = new FundsService()
