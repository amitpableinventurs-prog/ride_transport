import { useEffect, useState } from 'react'
import { IndianRupee, Percent, RotateCcw, Wallet } from 'lucide-react'
import { fetchRevenueReport } from '@/api/reports'
import type { RevenueReport } from '@/types/reports'
import { StatCard } from '@/components/common/StatCard'
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

export function RevenueReportPage() {
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setError(null)
    fetchRevenueReport(from, to)
      .then(setReport)
      .catch(() => setError('Could not load the revenue report.'))
  }, [from, to])

  function handleExport() {
    if (!report || report.byDay.length === 0) return
    downloadCsv(
      `revenue-report_${from}_to_${to}`,
      report.byDay.map((d) => ({ date: d.date, revenue: d.revenue })),
    )
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-brand-red">{error}</div>
  }

  if (!report) return <LoadingScreen />

  const maxTrend = Math.max(1, ...report.byDay.map((d) => d.revenue))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Revenue Report</h1>
        <p className="text-sm text-navy-400">Gross revenue, commission and refunds for the selected date range.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onExport={handleExport} exportDisabled={report.byDay.length === 0} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross Revenue" value={currency.format(report.summary.grossRevenue)} icon={IndianRupee} accent="green" />
        <StatCard label="Platform Commission" value={currency.format(report.summary.platformCommission)} icon={Percent} accent="navy" />
        <StatCard label="Refunds" value={currency.format(report.summary.refunds)} icon={RotateCcw} accent="red" />
        <StatCard label="Net Revenue" value={currency.format(report.summary.netRevenue)} icon={Wallet} accent="orange" />
      </div>

      <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-800">Revenue trend</h2>
        {report.byDay.length === 0 ? (
          <p className="mt-4 text-sm text-navy-300">No completed bookings in this date range.</p>
        ) : (
          <>
            <div className="mt-4 flex h-40 items-end gap-3">
              {report.byDay.map((d) => (
                <div key={d.date} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-navy-500"
                    style={{ height: `${Math.max(6, (d.revenue / maxTrend) * 100)}%` }}
                    title={currency.format(d.revenue)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3">
              {report.byDay.map((d) => (
                <span key={d.date} className="flex-1 text-center text-xs text-navy-300">
                  {d.date.slice(5)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
