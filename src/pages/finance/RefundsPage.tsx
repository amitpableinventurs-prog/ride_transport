import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Banknote, Plus, Search } from 'lucide-react'
import { fetchRefunds, approveRefund, rejectRefund, processRefund, fetchRefundBookingInfo, createRefund } from '@/api/refunds'
import type { Refund, RefundBookingInfo, PaginatedResult } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import { ExportButtons } from '@/components/common/ExportButtons'
import { fetchAllPages } from '@/lib/fetchAll'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function statusTone(status: Refund['status']): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'processed') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'approved' || status === 'processing') return 'info'
  return 'warning'
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

function DestinationCell({ refund }: { refund: Refund }) {
  if (refund.status !== 'processed' || !refund.destination) return <span className="text-navy-300">—</span>
  if (refund.destination === 'wallet') return <span className="text-navy-600">Customer wallet</span>
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-navy-600">Bank / card</span>
        {refund.gatewayStatus && (
          <Badge tone={refund.gatewayStatus === 'processed' ? 'success' : refund.gatewayStatus === 'failed' ? 'danger' : 'warning'}>{refund.gatewayStatus}</Badge>
        )}
      </div>
      {refund.gatewayRefundId && <p className="mt-0.5 font-mono text-xs text-navy-300">{refund.gatewayRefundId}</p>}
    </div>
  )
}

export function RefundsPage() {
  const [result, setResult] = useState<PaginatedResult<Refund> | null>(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function load() {
    return fetchRefunds({ status: status || undefined, page, limit: 20 }).then(setResult)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load refunds.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  function replace(refund: Refund) {
    setResult((prev) => (prev ? { ...prev, items: prev.items.map((r) => (r.id === refund.id ? refund : r)) } : prev))
  }

  async function handleApprove(refund: Refund) {
    setBusyId(refund.id)
    setError(null)
    try {
      replace(await approveRefund(refund.id))
    } catch {
      setError('Could not approve refund.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(refund: Refund) {
    setBusyId(refund.id)
    setError(null)
    try {
      replace(await rejectRefund(refund.id))
    } catch {
      setError('Could not reject refund.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleProcess(refund: Refund) {
    setBusyId(refund.id)
    setError(null)
    try {
      replace(await processRefund(refund.id))
    } catch (err) {
      setError(apiMessage(err, 'Could not process refund.'))
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  const filterSummary = status ? `Status: ${status}` : ''

  async function loadExportRows() {
    const items = await fetchAllPages((page, limit) => fetchRefunds({ status: status || undefined, page, limit }))
    return items.map((refund) => {
      const processed = refund.status === 'processed' && refund.destination
      return {
        Booking: refund.booking?.bookingCode ?? '',
        'Amount (INR)': refund.amount,
        Reason: refund.reason,
        Status: refund.status,
        'Sent to': !processed
          ? ''
          : refund.destination === 'wallet'
            ? 'Customer wallet'
            : `Bank / card${refund.gatewayStatus ? ` (${refund.gatewayStatus})` : ''}`,
        'Gateway refund ID': refund.gatewayRefundId ?? '',
        'Requested by': refund.requestedBy ?? '',
        Date: dateFmt.format(new Date(refund.createdAt)),
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Refunds</h1>
          <p className="text-sm text-navy-400">
            Online payments are refunded to the customer's bank or card through Razorpay; cash and wallet bookings are refunded to the wallet.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButtons title="Refunds" subtitle={filterSummary} loadRows={loadExportRows} disabled={!result || result.total === 0} />
          <PermissionGate permission="finance.manage">
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
            >
              <Plus size={16} /> New refund
            </button>
          </PermissionGate>
        </div>
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
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
          <option value="processed">Processed</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Sent to</th>
                  <th className="px-5 py-3 font-medium">Requested by</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((refund) => (
                  <tr key={refund.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">{refund.booking?.bookingCode ?? '—'}</td>
                    <td className="px-5 py-3 text-navy-800">{moneyFmt.format(refund.amount)}</td>
                    <td className="px-5 py-3 text-navy-600">{refund.reason}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(refund.status)}>{refund.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <DestinationCell refund={refund} />
                    </td>
                    <td className="px-5 py-3 text-navy-600">{refund.requestedBy ?? '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(refund.createdAt))}</td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="finance.manage">
                        <div className="flex items-center justify-end gap-2">
                          {refund.status === 'requested' && (
                            <>
                              <button
                                onClick={() => handleApprove(refund)}
                                disabled={busyId === refund.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-brand-green-dark hover:bg-green-50 disabled:opacity-50"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={() => handleReject(refund)}
                                disabled={busyId === refund.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50 disabled:opacity-50"
                              >
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}
                          {refund.status === 'approved' && (
                            <button
                              onClick={() => handleProcess(refund)}
                              disabled={busyId === refund.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-orange px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-50"
                            >
                              <Banknote size={14} /> Process
                            </button>
                          )}
                          {(refund.status === 'rejected' || refund.status === 'processed' || refund.status === 'processing') && (
                            <span className="text-xs text-navy-300">No actions</span>
                          )}
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy-300">
                      No refunds found.
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

      {creating && (
        <NewRefundModal
          onClose={() => setCreating(false)}
          onCreated={(refund) => {
            setResult((prev) => (prev ? { ...prev, items: [refund, ...prev.items], total: prev.total + 1 } : prev))
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

const DESTINATION_TEXT: Record<RefundBookingInfo['destination'], string> = {
  source: "Paid online: the refund goes back to the customer's bank / card / UPI through Razorpay (5-7 working days).",
  wallet: "Paid by cash or wallet: the refund goes to the customer's AnZ Cabs wallet.",
}

function NewRefundModal({ onClose, onCreated }: { onClose: () => void; onCreated: (refund: Refund) => void }) {
  const [bookingCode, setBookingCode] = useState('')
  const [info, setInfo] = useState<RefundBookingInfo | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLookup() {
    if (!bookingCode.trim()) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const found = await fetchRefundBookingInfo(bookingCode.trim())
      setInfo(found)
      setAmount(String(found.maxRefundable))
    } catch (err) {
      setError(apiMessage(err, 'Could not find that booking.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!info) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createRefund({ bookingCode: info.bookingCode, amount: Number(amount), reason: reason.trim() }))
    } catch (err) {
      setError(apiMessage(err, 'Could not create the refund.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="New refund" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Booking ID</label>
          <div className="flex gap-2">
            <input
              value={bookingCode}
              onChange={(e) => {
                setBookingCode(e.target.value)
                setInfo(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !info) {
                  e.preventDefault()
                  void handleLookup()
                }
              }}
              placeholder="BK-..."
              className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm uppercase outline-none focus:border-navy-400"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={busy || !bookingCode.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
            >
              <Search size={14} /> Check
            </button>
          </div>
        </div>

        {info && (
          <>
            <div className="space-y-1 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-600">
              <p>
                <span className="font-medium text-navy-800">{info.customer?.name || 'Customer'}</span>
                {info.customer?.phone ? ` · ${info.customer.phone}` : ''}
              </p>
              <p>
                Paid {moneyFmt.format(info.paidTotal)} via {info.paidVia} · already refunded {moneyFmt.format(info.alreadyRefunded)}
              </p>
              <p className="font-medium text-navy-800">Can refund up to {moneyFmt.format(info.maxRefundable)}</p>
              <p className="text-navy-500">{DESTINATION_TEXT[info.destination]}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">Amount</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={info.maxRefundable}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">Reason</label>
              <input
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Rider took a longer route"
                className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
              />
            </div>
          </>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={busy || !info || info.maxRefundable <= 0}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          Create refund request
        </button>
        <p className="text-center text-xs text-navy-400">The refund is sent only after it is approved and processed.</p>
      </form>
    </Modal>
  )
}
