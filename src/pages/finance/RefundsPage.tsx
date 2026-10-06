import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Banknote } from 'lucide-react'
import { fetchRefunds, approveRefund, rejectRefund, processRefund } from '@/api/refunds'
import type { Refund, PaginatedResult } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function statusTone(status: Refund['status']): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'processed') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'approved') return 'info'
  return 'warning'
}

export function RefundsPage() {
  const [result, setResult] = useState<PaginatedResult<Refund> | null>(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    } catch {
      setError('Could not process refund.')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Refunds</h1>
        <p className="text-sm text-navy-400">Customer refund requests awaiting approval, rejection or processing.</p>
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
          <option value="processed">Processed</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Status</th>
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
                          {(refund.status === 'rejected' || refund.status === 'processed') && (
                            <span className="text-xs text-navy-300">No actions</span>
                          )}
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
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
    </div>
  )
}
