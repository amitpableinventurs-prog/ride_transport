import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { fetchRiderReport } from '@/api/reports'
import type { RiderReport } from '@/types/reports'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { DateRangeFilter } from '@/components/reports/DateRangeFilter'
import { downloadCsv } from '@/lib/csv'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: toDateInputValue(from), to: toDateInputValue(to) }
}

export function RiderReportPage() {
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [report, setReport] = useState<RiderReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setError(null)
    fetchRiderReport(from, to)
      .then(setReport)
      .catch(() => setError('Could not load the rider report.'))
  }, [from, to])

  function handleExport() {
    if (!report || report.rows.length === 0) return
    downloadCsv(
      `rider-report_${from}_to_${to}`,
      report.rows.map((r) => ({
        driverName: r.driverName,
        serviceType: r.serviceType,
        totalTrips: r.totalTrips,
        completedInRange: r.completedInRange,
        cancelledInRange: r.cancelledInRange,
        earnings: r.earnings,
        rating: r.rating,
      })),
    )
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-brand-red">{error}</div>
  }

  if (!report) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Rider Report</h1>
        <p className="text-sm text-navy-400">Per-rider/driver trip counts and earnings for the selected date range.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onExport={handleExport} exportDisabled={report.rows.length === 0} />

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Service Type</th>
              <th className="px-5 py-3 text-right font-medium">Total Trips</th>
              <th className="px-5 py-3 text-right font-medium">Completed (range)</th>
              <th className="px-5 py-3 text-right font-medium">Cancelled (range)</th>
              <th className="px-5 py-3 text-right font-medium">Earnings</th>
              <th className="px-5 py-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.driverName + r.serviceType} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-700">{r.driverName}</td>
                <td className="px-5 py-3">
                  <Badge tone={r.serviceType === 'driver' ? 'info' : 'neutral'}>{r.serviceType}</Badge>
                </td>
                <td className="px-5 py-3 text-right text-navy-600">{r.totalTrips}</td>
                <td className="px-5 py-3 text-right text-brand-green-dark">{r.completedInRange}</td>
                <td className="px-5 py-3 text-right text-brand-red">{r.cancelledInRange}</td>
                <td className="px-5 py-3 text-right text-navy-700">{currency.format(r.earnings)}</td>
                <td className="px-5 py-3 text-navy-600">
                  <span className="inline-flex items-center gap-1">
                    <Star size={14} className="text-brand-orange" />
                    {r.rating.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                  No riders/drivers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
