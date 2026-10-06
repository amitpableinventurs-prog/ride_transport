// Rider app: wallet, cash dues and payouts.
import type { Request, Response } from 'express'
import { Withdrawal, type WithdrawalDocument } from '../../models/Withdrawal'
import { WalletTransaction } from '../../models/WalletTransaction'
import { createGatewayOrder, verifyGatewayPayment } from '../../services/gatewayPayments'
import { HttpError, parseAmount, parsePagination, requireString } from '../../utils/http'
import { getPlatformSettings } from '../../utils/settings'
import { debitWallet, getOrCreateWallet } from '../../utils/wallet'

const MAX_WITHDRAWAL = 100_000
const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^\d{9,18}$/

const riderId = (req: Request) => req.appUser!.doc._id

// GET /wallet: a negative balance is commission owed on cash trips (dues).
export async function getWallet(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const wallet = await getOrCreateWallet('driver', riderId(req))
  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments({ wallet: wallet._id }),
  ])
  res.json({
    balance: wallet.balance,
    currency: wallet.currency,
    dues: Math.max(0, -wallet.balance),
    withdrawable: Math.max(0, wallet.balance),
    transactions: { items: transactions, total, page, limit },
  })
}

// POST /wallet/pay-dues: gateway order to clear dues (all of them unless `amount` is sent).
export async function payDues(req: Request, res: Response) {
  const wallet = await getOrCreateWallet('driver', riderId(req))
  const dues = Math.max(0, -wallet.balance)
  if (!dues) throw new HttpError(409, 'You have no dues to pay')
  const body = (req.body ?? {}) as { amount?: unknown }
  const amount = body.amount === undefined ? dues : parseAmount(body.amount, 'amount', { min: 1, max: dues })
  res.status(201).json(await createGatewayOrder({ purpose: 'rider_dues', ownerType: 'driver', ownerId: riderId(req), amount }))
}

// POST /payments/verify: confirms a dues payment after the gateway checkout.
export async function verifyPayment(req: Request, res: Response) {
  res.json(await verifyGatewayPayment({ type: 'driver', id: riderId(req) }, req.body as Record<string, unknown>))
}

function serializeWithdrawal(w: { toJSON(): Record<string, unknown> } & Pick<WithdrawalDocument, 'bankAccount'>) {
  const json = w.toJSON() as Record<string, unknown> & { bankAccount?: { accountNumber?: string } }
  if (json.bankAccount?.accountNumber) json.bankAccount = { ...json.bankAccount, accountNumber: `XXXX${json.bankAccount.accountNumber.slice(-4)}` }
  return json
}

// POST /withdrawals: the amount is held from the wallet until the payout is processed.
export async function requestWithdrawal(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const settings = await getPlatformSettings()
  const amount = parseAmount(body.amount, 'amount', { min: settings.minWithdrawalAmount, max: MAX_WITHDRAWAL })

  const method = body.method
  let payout: Pick<WithdrawalDocument, 'upiId' | 'bankAccount'>
  if (method === 'upi') {
    const upiId = requireString(body.upiId, 'upiId', 300)
    if (!UPI_RE.test(upiId)) throw new HttpError(400, 'Enter a valid UPI ID, e.g. name@okbank')
    payout = { upiId }
  } else if (method === 'bank') {
    const account = (body.bankAccount ?? {}) as Record<string, unknown>
    const holderName = requireString(account.holderName, 'bankAccount.holderName', 100)
    const accountNumber = requireString(account.accountNumber, 'bankAccount.accountNumber', 18)
    const ifsc = requireString(account.ifsc, 'bankAccount.ifsc', 11).toUpperCase()
    if (!ACCOUNT_RE.test(accountNumber)) throw new HttpError(400, 'Enter a valid bank account number')
    if (!IFSC_RE.test(ifsc)) throw new HttpError(400, 'Enter a valid IFSC code')
    payout = { bankAccount: { holderName, accountNumber, ifsc } }
  } else {
    throw new HttpError(400, 'method must be bank or upi')
  }

  if (await Withdrawal.exists({ driver: riderId(req), status: { $in: ['requested', 'processing'] } })) {
    throw new HttpError(409, 'You already have a payout in progress')
  }

  const withdrawal = new Withdrawal({ driver: riderId(req), amount, method, ...payout })
  const wallet = await debitWallet({ ownerType: 'driver', ownerId: riderId(req), amount, reason: 'withdrawal', referenceType: 'Withdrawal', referenceId: withdrawal._id })
  withdrawal.wallet = wallet!._id
  await withdrawal.save()
  res.status(201).json({ ...serializeWithdrawal(withdrawal), note: 'Payouts are processed within 2 working days.' })
}

// GET /withdrawals
export async function listWithdrawals(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const filter = { driver: riderId(req) }
  const [items, total] = await Promise.all([Withdrawal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Withdrawal.countDocuments(filter)])
  res.json({ items: items.map(serializeWithdrawal), total, page, limit })
}
