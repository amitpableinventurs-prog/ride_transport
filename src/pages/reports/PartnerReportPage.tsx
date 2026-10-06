import { useEffect, useState } from 'react'
import { fetchPartnerReport } from '@/api/reports'
import type { PartnerReport } from '@/types/reports'
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

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'warning'
  if (status === 'blocked') return 'danger'
  return 'neutral'
}

export function PartnerReportPage() {
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [report, setReport] = useState<PartnerReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setError(null)
    fetchPartnerReport(from, to)
      .then(setReport)
      .catch(() => setError('Could not load the partner report.'))
  }, [from, to])

  function handleExport() {
    if (!report || report.rows.length === 0) return
    downloadCsv(
      `partner-report_${from}_to_${to}`,
      report.rows.map((r) => ({
        companyName: r.companyName,
        vehicleCount: r.vehicleCount,
        driverCount: r.driverCount,
        deliveriesInRange: r.deliveriesInRange,
        revenueInRange: r.revenueInRange,
        status: r.status,
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
        <h1 className="text-xl font-semibold text-navy-800">Partner Report</h1>
        <p className="text-sm text-navy-400">Per-partner fleet size and transport delivery revenue for the selected date range.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onExport={handleExport} exportDisabled={report.rows.length === 0} />

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 text-right font-medium">Vehicles</th>
              <th className="px-5 py-3 text-right font-medium">Drivers</th>
              <th className="px-5 py-3 text-right font-medium">Deliveries (range)</th>
              <th className="px-5 py-3 text-right font-medium">Revenue (range)</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.companyName} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-700">{r.companyName}</td>
                <td className="px-5 py-3 text-right text-navy-600">{r.vehicleCount}</td>
                <td className="px-5 py-3 text-right text-navy-600">{r.driverCount}</td>
                <td className="px-5 py-3 text-right text-navy-600">{r.deliveriesInRange}</td>
                <td className="px-5 py-3 text-right text-navy-700">{currency.format(r.revenueInRange)}</td>
                <td className="px-5 py-3">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
              </tr>
            ))}
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-navy-300">
                  No transport partners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
