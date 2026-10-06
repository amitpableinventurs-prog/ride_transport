import { apiClient } from './client'
import type { PaginatedResult, Wallet, WalletTransaction, WalletTransactionReason } from '@/types/finance'

export async function fetchWallets(params?: { ownerType?: string; page?: number; limit?: number }): Promise<PaginatedResult<Wallet>> {
  const { data } = await apiClient.get<PaginatedResult<Wallet>>('/wallets', { params })
  return data
}

export async function fetchWalletTransactions(walletId: string): Promise<WalletTransaction[]> {
  const { data } = await apiClient.get<WalletTransaction[]>(`/wallets/${walletId}/transactions`)
  return data
}

export async function adjustWallet(
  walletId: string,
  input: { type: 'credit' | 'debit'; amount: number; reason: WalletTransactionReason },
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  const { data } = await apiClient.post<{ wallet: Wallet; transaction: WalletTransaction }>(`/wallets/${walletId}/adjust`, input)
  return data
}
