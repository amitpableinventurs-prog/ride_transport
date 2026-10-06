import type { Types } from 'mongoose'
import { Wallet } from '../models/Wallet'
import { WalletTransaction, type WalletTransactionDocument } from '../models/WalletTransaction'
import { HttpError, roundMoney } from './http'

type OwnerType = 'customer' | 'driver' | 'partner'
type Reason = WalletTransactionDocument['reason']

export async function getOrCreateWallet(ownerType: OwnerType, ownerId: Types.ObjectId | string) {
  return Wallet.findOneAndUpdate(
    { ownerType, ownerId },
    { $setOnInsert: { ownerType, ownerId, balance: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

interface Movement {
  ownerType: OwnerType
  ownerId: Types.ObjectId | string
  amount: number
  reason: Reason
  referenceType?: string
  referenceId?: Types.ObjectId | string
  /** Debits only: allow the balance to go negative (rider commission dues, cancellation charges). */
  allowNegative?: boolean
}

async function move(type: 'credit' | 'debit', m: Movement) {
  const amount = roundMoney(m.amount)
  if (amount <= 0) return null
  const wallet = await getOrCreateWallet(m.ownerType, m.ownerId)
  const delta = type === 'credit' ? amount : -amount

  // Atomic balance change; a debit without allowNegative only succeeds when the balance covers it.
  const filter = type === 'debit' && !m.allowNegative ? { _id: wallet._id, balance: { $gte: amount } } : { _id: wallet._id }
  const updated = await Wallet.findOneAndUpdate(filter, { $inc: { balance: delta } }, { new: true })
  if (!updated) throw new HttpError(402, 'Insufficient wallet balance', { balance: wallet.balance, required: amount })

  await WalletTransaction.create({
    wallet: updated._id,
    type,
    amount,
    reason: m.reason,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    balanceAfter: roundMoney(updated.balance),
  })
  return updated
}

export const creditWallet = (m: Movement) => move('credit', m)
export const debitWallet = (m: Movement) => move('debit', m)
