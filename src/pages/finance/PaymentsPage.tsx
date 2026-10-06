import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchPayments } from '@/api/payments'
import type { Payment, PaginatedResult } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function statusTone(status: Payment['status']): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'refunded') return 'info'
  return 'warning'
}

export function PaymentsPage() {
  const [result, setResult] = useState<PaginatedResult<Payment> | null>(null)
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPayments({ status: status || undefined, method: method || undefined, q: q || undefined, page, limit: 20 })
      .then(setResult)
      .catch(() => setError('Could not load payments.'))
  }, [status, method, q, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Payments</h1>
        <p className="text-sm text-navy-400">Payment records collected across ride and transport bookings.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            value={q}
            onChange={(e) => {
              setPage(1)
              setQ(e.target.value)
            }}
            placeholder="Search by booking code…"
            className="w-64 rounded-lg border border-navy-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="initiated">Initiated</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          value={method}
          onChange={(e) => {
            setPage(1)
            setMethod(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="netbanking">Netbanking</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Gateway</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((payment) => (
                  <tr key={payment.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">{payment.booking?.bookingCode ?? '—'}</td>
                    <td className="px-5 py-3 text-navy-600">{payment.booking?.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-navy-800">{moneyFmt.format(payment.amount)}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{payment.method}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-600 capitalize">{payment.gateway}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(payment.createdAt))}</td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No payments found.
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
