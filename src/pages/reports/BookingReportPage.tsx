import { useEffect, useState } from 'react'
import { ListChecks, CheckCircle2, XCircle, IndianRupee } from 'lucide-react'
import { fetchBookingReport } from '@/api/reports'
import type { BookingReport } from '@/types/reports'
import { StatCard } from '@/components/common/StatCard'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'
import { downloadCsv } from '@/lib/csv'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: toDateInputValue(from), to: toDateInputValue(to) }
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (['accepted', 'arriving', 'started', 'in_transit'].includes(status)) return 'warning'
  return 'neutral'
}

export function BookingReportPage() {
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [mode, setMode] = useState('')
  const [status, setStatus] = useState('')
  const [report, setReport] = useState<BookingReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setError(null)
    fetchBookingReport(from, to, { mode: mode || undefined, status: status || undefined })
      .then(setReport)
      .catch(() => setError('Could not load the booking report.'))
  }, [from, to, mode, status])

  function handleExport() {
    if (!report || report.rows.length === 0) return
    downloadCsv(`booking-report_${from}_to_${to}`, [
      ...report.rows.map((r) => ({
        bookingCode: r.bookingCode,
        mode: r.mode,
        category: r.categoryKey,
        customer: r.customerName,
        driver: r.driverName,
        status: r.status,
        fareTotal: r.fareTotal,
        createdAt: r.createdAt,
      })),
    ])
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-brand-red">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Booking Report</h1>
        <p className="text-sm text-navy-400">Bookings across Ride and Transport, filtered by date range.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onExport={handleExport} exportDisabled={!report || report.rows.length === 0} />

      <div className="flex flex-wrap gap-3">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        >
          <option value="">All modes</option>
          <option value="ride">Ride</option>
          <option value="transport">Transport</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="accepted">Accepted</option>
          <option value="arriving">Arriving</option>
          <option value="started">Started</option>
          <option value="in_transit">In Transit</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {!report ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Bookings" value={String(report.summary.total)} icon={ListChecks} accent="navy" />
            <StatCard label="Completed" value={String(report.summary.completed)} icon={CheckCircle2} accent="green" />
            <StatCard label="Cancelled" value={String(report.summary.cancelled)} icon={XCircle} accent="red" />
            <StatCard label="Total Fare" value={currency.format(report.summary.totalFare)} icon={IndianRupee} accent="orange" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Mode / Category</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Fare</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.bookingCode} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-700">{r.bookingCode}</td>
                    <td className="px-5 py-3 text-navy-500">{r.customerName}</td>
                    <td className="px-5 py-3 text-navy-500">{r.driverName}</td>
                    <td className="px-5 py-3 text-navy-500">
                      {r.mode} · {r.categoryKey}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-navy-700">{currency.format(r.fareTotal)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(r.createdAt))}</td>
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No bookings in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
