import { useEffect, useState } from 'react'
import { IndianRupee, RotateCcw, Wallet, ArrowLeftRight } from 'lucide-react'
import { fetchFinancialReport } from '@/api/reports'
import type { FinancialReport } from '@/types/reports'
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

export function FinancialReportPage() {
  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setError(null)
    fetchFinancialReport(from, to)
      .then(setReport)
      .catch(() => setError('Could not load the financial report.'))
  }, [from, to])

  function handleExport() {
    if (!report || report.rows.length === 0) return
    downloadCsv(
      `financial-report_${from}_to_${to}`,
      report.rows.map((r) => ({
        date: r.date,
        paymentsCount: r.paymentsCount,
        paymentsAmount: r.paymentsAmount,
        refundsCount: r.refundsCount,
        refundsAmount: r.refundsAmount,
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
        <h1 className="text-xl font-semibold text-navy-800">Financial Report</h1>
        <p className="text-sm text-navy-400">Day-by-day payments, refunds and wallet movement ledger.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onExport={handleExport} exportDisabled={report.rows.length === 0} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Gross Revenue" value={currency.format(report.summary.grossRevenue)} icon={IndianRupee} accent="green" />
        <StatCard label="Refunds" value={currency.format(report.summary.refunds)} icon={RotateCcw} accent="red" />
        <StatCard label="Net Revenue" value={currency.format(report.summary.netRevenue)} icon={Wallet} accent="orange" />
        <StatCard label="Wallet Credits" value={currency.format(report.summary.walletCreditsTotal)} icon={ArrowLeftRight} accent="navy" />
        <StatCard label="Wallet Debits" value={currency.format(report.summary.walletDebitsTotal)} icon={ArrowLeftRight} accent="navy" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 text-right font-medium">Payments</th>
              <th className="px-5 py-3 text-right font-medium">Payments Amount</th>
              <th className="px-5 py-3 text-right font-medium">Refunds</th>
              <th className="px-5 py-3 text-right font-medium">Refunds Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.date} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-700">{r.date}</td>
                <td className="px-5 py-3 text-right text-navy-600">{r.paymentsCount}</td>
                <td className="px-5 py-3 text-right text-brand-green-dark">{currency.format(r.paymentsAmount)}</td>
                <td className="px-5 py-3 text-right text-navy-600">{r.refundsCount}</td>
                <td className="px-5 py-3 text-right text-brand-red">{currency.format(r.refundsAmount)}</td>
              </tr>
            ))}
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-navy-300">
                  No payment or refund activity in this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
