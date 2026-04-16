import { Pocket, Wallet, WalletBalance, PocketSummary } from './types.js'
import { generateId } from './utils.js'

export function createPocket(ownerId: string, name = 'My Pocket'): Omit<Pocket, 'id'> {
  return {
    ownerId,
    name,
    wallets: [],
    nativeBalance: BigInt(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function addWallet(pocket: Pocket, wallet: Omit<Wallet, 'id' | 'pocketId' | 'addedAt'>): Pocket {
  const newWallet: Wallet = {
    ...wallet,
    id: generateId(),
    pocketId: pocket.id,
    addedAt: new Date(),
  }
  return {
    ...pocket,
    wallets: [...pocket.wallets, newWallet],
    updatedAt: new Date(),
  }
}

export function removeWallet(pocket: Pocket, walletId: string): Pocket {
  return {
    ...pocket,
    wallets: pocket.wallets.filter((w) => w.id !== walletId),
    updatedAt: new Date(),
  }
}

export function setDefaultWallet(pocket: Pocket, walletId: string): Pocket {
  return {
    ...pocket,
    wallets: pocket.wallets.map((w) => ({
      ...w,
      isDefault: w.id === walletId,
    })),
    updatedAt: new Date(),
  }
}

export function depositToNative(pocket: Pocket, amount: bigint): Pocket {
  return {
    ...pocket,
    nativeBalance: pocket.nativeBalance + amount,
    updatedAt: new Date(),
  }
}

export function withdrawFromNative(pocket: Pocket, amount: bigint): Pocket {
  if (amount > pocket.nativeBalance) {
    throw new Error('Insufficient native balance')
  }
  return {
    ...pocket,
    nativeBalance: pocket.nativeBalance - amount,
    updatedAt: new Date(),
  }
}

export function buildSummary(pocket: Pocket, balances: WalletBalance[]): PocketSummary {
  const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0)
  return { pocket, totalUsdValue, balances }
}
