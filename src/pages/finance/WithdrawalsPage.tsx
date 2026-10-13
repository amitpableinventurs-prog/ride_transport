import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Clock } from 'lucide-react'
import { fetchWithdrawals, markWithdrawalPaid, markWithdrawalProcessing, rejectWithdrawal } from '@/api/withdrawals'
import type { PaginatedResult, Withdrawal, WithdrawalStatus } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function statusTone(status: WithdrawalStatus): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'paid') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'processing') return 'info'
  return 'warning'
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

function PayoutDetails({ withdrawal }: { withdrawal: Withdrawal }) {
  if (withdrawal.method === 'upi') {
    return (
      <div>
        <p className="text-xs text-navy-400">UPI</p>
        <p className="font-mono text-navy-700">{withdrawal.upiId}</p>
      </div>
    )
  }
  const account = withdrawal.bankAccount ?? {}
  return (
    <div>
      <p className="text-xs text-navy-400">Bank · {account.holderName}</p>
      <p className="font-mono text-navy-700">{account.accountNumber}</p>
      <p className="font-mono text-xs text-navy-500">{account.ifsc}</p>
    </div>
  )
}

export function WithdrawalsPage() {
  const [result, setResult] = useState<PaginatedResult<Withdrawal> | null>(null)
  const [status, setStatus] = useState('requested')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [paying, setPaying] = useState<Withdrawal | null>(null)
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null)

  useEffect(() => {
    fetchWithdrawals({ status: status || undefined, page, limit: 20 })
      .then(setResult)
      .catch(() => setError('Could not load payout requests.'))
  }, [status, page])

  function replace(withdrawal: Withdrawal) {
    setResult((prev) => (prev ? { ...prev, items: prev.items.map((w) => (w.id === withdrawal.id ? withdrawal : w)) } : prev))
  }

  async function handleProcessing(withdrawal: Withdrawal) {
    setBusyId(withdrawal.id)
    setError(null)
    try {
      replace(await markWithdrawalProcessing(withdrawal.id))
    } catch (err) {
      setError(apiMessage(err, 'Could not update the payout.'))
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Rider Withdrawals</h1>
        <p className="text-sm text-navy-400">
          Riders withdraw their wallet earnings (minimum set in Settings). The amount is held from the wallet until you pay it or reject it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Rider</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Pay to</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Requested</th>
                  <th className="px-5 py-3 font-medium">Reference / reason</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((withdrawal) => {
                  const open = withdrawal.status === 'requested' || withdrawal.status === 'processing'
                  return (
                    <tr key={withdrawal.id} className="border-b border-navy-50 align-top last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-navy-800">{withdrawal.driver?.name || 'Rider'}</p>
                        <p className="text-xs text-navy-400">{withdrawal.driver?.phone}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-navy-800">{moneyFmt.format(withdrawal.amount)}</td>
                      <td className="px-5 py-3">
                        <PayoutDetails withdrawal={withdrawal} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(withdrawal.status)}>{withdrawal.status}</Badge>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(withdrawal.createdAt))}</td>
                      <td className="px-5 py-3 text-navy-600">
                        {withdrawal.status === 'paid' && <span className="font-mono text-xs">{withdrawal.reference}</span>}
                        {withdrawal.status === 'rejected' && <span className="text-xs">{withdrawal.rejectionReason}</span>}
                        {open && <span className="text-navy-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <PermissionGate permission="finance.manage">
                          {open ? (
                            <div className="flex items-center justify-end gap-2">
                              {withdrawal.status === 'requested' && (
                                <button
                                  onClick={() => handleProcessing(withdrawal)}
                                  disabled={busyId === withdrawal.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                                >
                                  <Clock size={14} /> Processing
                                </button>
                              )}
                              <button
                                onClick={() => setPaying(withdrawal)}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand-orange px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange-dark"
                              >
                                <Check size={14} /> Mark paid
                              </button>
                              <button
                                onClick={() => setRejecting(withdrawal)}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-navy-300">No actions</span>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  )
                })}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No payout requests found.
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

      {paying && (
        <ResolveModal
          title={`Mark paid · ${moneyFmt.format(paying.amount)}`}
          label="UTR / transaction reference"
          placeholder="e.g. 412345678901"
          help="Send the money from your bank or UPI app first, then enter its reference here. The rider is notified."
          submitLabel="Mark as paid"
          onClose={() => setPaying(null)}
          onSubmit={async (reference) => {
            replace(await markWithdrawalPaid(paying.id, reference))
            setPaying(null)
          }}
        />
      )}

      {rejecting && (
        <ResolveModal
          title={`Reject payout · ${moneyFmt.format(rejecting.amount)}`}
          label="Reason (shown to the rider)"
          placeholder="e.g. Bank account details do not match"
          help="The held amount goes back to the rider's wallet."
          submitLabel="Reject payout"
          danger
          onClose={() => setRejecting(null)}
          onSubmit={async (reason) => {
            replace(await rejectWithdrawal(rejecting.id, reason))
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}

function ResolveModal({
  title,
  label,
  placeholder,
  help,
  submitLabel,
  danger,
  onClose,
  onSubmit,
}: {
  title: string
  label: string
  placeholder: string
  help: string
  submitLabel: string
  danger?: boolean
  onClose: () => void
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(value.trim())
    } catch (err) {
      setError(apiMessage(err, 'Could not update the payout.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-navy-400">{help}</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">{label}</label>
          <input
            required
            maxLength={300}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
            danger ? 'bg-brand-red hover:opacity-90' : 'bg-brand-orange hover:bg-brand-orange-dark'
          }`}
        >
          {submitLabel}
        </button>
      </form>
    </Modal>
  )
}
