import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, History, Plus, Minus } from 'lucide-react'
import { fetchWallets, fetchWalletTransactions, adjustWallet } from '@/api/wallets'
import type { Wallet, WalletTransaction, WalletTransactionReason, PaginatedResult } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const REASON_OPTIONS: WalletTransactionReason[] = ['adjustment', 'bonus', 'penalty', 'recharge', 'withdrawal', 'refund']

export function WalletsPage() {
  const [result, setResult] = useState<PaginatedResult<Wallet> | null>(null)
  const [ownerType, setOwnerType] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [historyWallet, setHistoryWallet] = useState<Wallet | null>(null)
  const [adjustingWallet, setAdjustingWallet] = useState<Wallet | null>(null)

  function load() {
    return fetchWallets({ ownerType: ownerType || undefined, page, limit: 20 }).then(setResult)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load wallets.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Wallets</h1>
        <p className="text-sm text-navy-400">Customer, driver and partner wallet balances.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={ownerType}
          onChange={(e) => {
            setPage(1)
            setOwnerType(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All owner types</option>
          <option value="customer">Customer</option>
          <option value="driver">Driver</option>
          <option value="partner">Partner</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Balance</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((wallet) => (
                  <tr key={wallet.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">{wallet.ownerName}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{wallet.ownerType}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-800">{moneyFmt.format(wallet.balance)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(wallet.updatedAt))}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setHistoryWallet(wallet)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                        >
                          <History size={14} /> Transactions
                        </button>
                        <PermissionGate permission="finance.manage">
                          <button
                            onClick={() => setAdjustingWallet(wallet)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange-dark"
                          >
                            Adjust
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-navy-300">
                      No wallets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-navy-500">
            <span>
              Page {result.page} of {totalPages} · {result.total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={result.page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={result.page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-3 py-1.5 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {historyWallet && <WalletHistoryModal wallet={historyWallet} onClose={() => setHistoryWallet(null)} />}

      {adjustingWallet && (
        <AdjustBalanceModal
          wallet={adjustingWallet}
          onClose={() => setAdjustingWallet(null)}
          onAdjusted={(updated) => {
            setResult((prev) => (prev ? { ...prev, items: prev.items.map((w) => (w.id === updated.id ? updated : w)) } : prev))
            setAdjustingWallet(null)
          }}
        />
      )}
    </div>
  )
}

function WalletHistoryModal({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const [transactions, setTransactions] = useState<WalletTransaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWalletTransactions(wallet.id)
      .then(setTransactions)
      .catch(() => setError('Could not load transaction history.'))
  }, [wallet.id])

  return (
    <Modal title={`Transactions · ${wallet.ownerName}`} onClose={onClose}>
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
        {!transactions && !error && <p className="text-sm text-navy-400">Loading…</p>}
        {transactions?.length === 0 && <p className="text-sm text-navy-400">No transactions yet.</p>}
        {transactions?.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg border border-navy-50 px-3 py-2">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={tx.type === 'credit' ? 'success' : 'danger'}>{tx.type}</Badge>
                <span className="text-xs text-navy-500">{tx.reason.replace('_', ' ')}</span>
              </div>
              <p className="mt-1 text-xs text-navy-300">{dateFmt.format(new Date(tx.createdAt))}</p>
            </div>
            <div className="text-right">
              <p className={tx.type === 'credit' ? 'font-semibold text-brand-green-dark' : 'font-semibold text-brand-red'}>
                {tx.type === 'credit' ? '+' : '-'}
                {moneyFmt.format(tx.amount)}
              </p>
              <p className="text-xs text-navy-400">Balance: {moneyFmt.format(tx.balanceAfter)}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function AdjustBalanceModal({
  wallet,
  onClose,
  onAdjusted,
}: {
  wallet: Wallet
  onClose: () => void
  onAdjusted: (wallet: Wallet) => void
}) {
  const [type, setType] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<WalletTransactionReason>('adjustment')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { wallet: updated } = await adjustWallet(wallet.id, { type, amount: Number(amount), reason })
      onAdjusted(updated)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not adjust balance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Adjust balance · ${wallet.ownerName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-navy-400">Current balance: {moneyFmt.format(wallet.balance)}</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('credit')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              type === 'credit' ? 'border-brand-green-dark bg-green-50 text-brand-green-dark' : 'border-navy-100 text-navy-500'
            }`}
          >
            <Plus size={14} /> Credit
          </button>
          <button
            type="button"
            onClick={() => setType('debit')}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              type === 'debit' ? 'border-brand-red bg-red-50 text-brand-red' : 'border-navy-100 text-navy-500'
            }`}
          >
            <Minus size={14} /> Debit
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as WalletTransactionReason)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          Apply adjustment
        </button>
      </form>
    </Modal>
  )
}
