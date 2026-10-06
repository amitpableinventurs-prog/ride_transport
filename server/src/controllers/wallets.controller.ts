import type { Request, Response } from 'express'
import { Wallet } from '../models/Wallet'
import { WalletTransaction } from '../models/WalletTransaction'
import { Customer } from '../models/Customer'
import { Driver } from '../models/Driver'
import { TransportPartner } from '../models/TransportPartner'
import { recordAudit } from '../utils/audit'

type OwnerType = 'customer' | 'driver' | 'partner'
const WALLET_REASONS = ['booking_earning', 'commission', 'recharge', 'refund', 'penalty', 'bonus', 'withdrawal', 'adjustment'] as const
type WalletReason = (typeof WALLET_REASONS)[number]

async function resolveOwnerName(ownerType: OwnerType, ownerId: unknown): Promise<string> {
  if (ownerType === 'customer') {
    const customer = await Customer.findById(ownerId).select('name')
    return customer?.name ?? 'Unknown customer'
  }
  if (ownerType === 'driver') {
    const driver = await Driver.findById(ownerId).select('name')
    return driver?.name ?? 'Unknown driver'
  }
  const partner = await TransportPartner.findById(ownerId).select('companyName')
  return partner?.companyName ?? 'Unknown partner'
}

function parsePagination(query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, pageSize }
}

export async function listWallets(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  const { ownerType } = query
  const filter: Record<string, unknown> = {}
  if (ownerType) filter.ownerType = ownerType

  const { page, pageSize } = parsePagination(query)

  const [wallets, total] = await Promise.all([
    Wallet.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Wallet.countDocuments(filter),
  ])

  const items = await Promise.all(
    wallets.map(async (wallet) => ({
      ...wallet.toJSON(),
      ownerName: await resolveOwnerName(wallet.ownerType as OwnerType, wallet.ownerId),
    })),
  )

  res.json({ items, total, page, pageSize })
}

export async function getWalletTransactions(req: Request, res: Response) {
  const wallet = await Wallet.findById(req.params.id)
  if (!wallet) {
    res.status(404).json({ message: 'Wallet not found' })
    return
  }

  const transactions = await WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 })
  res.json(transactions)
}

export async function adjustWallet(req: Request, res: Response) {
  const wallet = await Wallet.findById(req.params.id)
  if (!wallet) {
    res.status(404).json({ message: 'Wallet not found' })
    return
  }

  const { type, amount, reason } = req.body as { type?: 'credit' | 'debit'; amount?: number; reason?: string }
  if (type !== 'credit' && type !== 'debit') {
    res.status(400).json({ message: 'type must be credit or debit' })
    return
  }
  if (!amount || amount <= 0) {
    res.status(400).json({ message: 'amount must be a positive number' })
    return
  }

  const resolvedReason: WalletReason = (WALLET_REASONS as readonly string[]).includes(reason ?? '')
    ? (reason as WalletReason)
    : 'adjustment'

  const delta = type === 'credit' ? amount : -amount
  const updatedWallet = await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: delta } }, { new: true })
  if (!updatedWallet) {
    res.status(404).json({ message: 'Wallet not found' })
    return
  }

  const transaction = await WalletTransaction.create({
    wallet: wallet._id,
    type,
    amount,
    reason: resolvedReason,
    referenceType: 'manual_adjustment',
    balanceAfter: updatedWallet.balance,
    createdBy: req.admin!._id,
  })

  await recordAudit(req.admin!, 'wallet.adjusted', 'Wallet', `${wallet.ownerType}:${wallet.ownerId}`, {
    type,
    amount,
    reason: resolvedReason,
  })

  res.json({ wallet: updatedWallet, transaction })
}
