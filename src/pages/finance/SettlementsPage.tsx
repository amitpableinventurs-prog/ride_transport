import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { fetchSettlements, markSettlementPaid } from '@/api/settlements'
import type { Settlement, PaginatedResult } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })

function statusTone(status: Settlement['status']): 'success' | 'warning' | 'info' {
  if (status === 'paid') return 'success'
  if (status === 'processing') return 'info'
  return 'warning'
}

export function SettlementsPage() {
  const [result, setResult] = useState<PaginatedResult<Settlement> | null>(null)
  const [payeeType, setPayeeType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load() {
    return fetchSettlements({ payeeType: payeeType || undefined, status: status || undefined, page, limit: 20 }).then(setResult)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load settlements.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payeeType, status, page])

  async function handleMarkPaid(settlement: Settlement) {
    setBusyId(settlement.id)
    setError(null)
    try {
      const updated = await markSettlementPaid(settlement.id)
      setResult((prev) => (prev ? { ...prev, items: prev.items.map((s) => (s.id === updated.id ? { ...updated, payeeName: s.payeeName } : s)) } : prev))
    } catch {
      setError('Could not mark settlement as paid.')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Settlements</h1>
        <p className="text-sm text-navy-400">Periodic payout settlements for drivers and transport partners.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={payeeType}
          onChange={(e) => {
            setPage(1)
            setPayeeType(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All payee types</option>
          <option value="driver">Driver</option>
          <option value="partner">Transport Partner</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!result ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Payee</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Gross earnings</th>
                  <th className="px-5 py-3 font-medium">Commission</th>
                  <th className="px-5 py-3 font-medium">Net payable</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((settlement) => (
                  <tr key={settlement.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">{settlement.payeeName}</td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{settlement.payeeType}</Badge>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-navy-600">
                      {dateFmt.format(new Date(settlement.periodStart))} – {dateFmt.format(new Date(settlement.periodEnd))}
                    </td>
                    <td className="px-5 py-3 text-navy-600">{moneyFmt.format(settlement.grossEarnings)}</td>
                    <td className="px-5 py-3 text-navy-600">{moneyFmt.format(settlement.commissionDeducted)}</td>
                    <td className="px-5 py-3 font-medium text-navy-800">{moneyFmt.format(settlement.netPayable)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(settlement.status)}>{settlement.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="finance.manage">
                        {settlement.status !== 'paid' ? (
                          <button
                            onClick={() => handleMarkPaid(settlement)}
                            disabled={busyId === settlement.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} /> Mark paid
                          </button>
                        ) : (
                          <span className="text-xs text-navy-300">Paid</span>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy-300">
                      No settlements found.
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
