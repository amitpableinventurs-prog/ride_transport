import { useEffect, useState } from 'react'
import { Users, Bike, Building2, CarFront, ListChecks, IndianRupee, AlertTriangle, Clock } from 'lucide-react'
import { fetchDashboardStats } from '@/api/dashboard'
import type { DashboardStats } from '@/types/dashboard'
import { StatCard } from '@/components/common/StatCard'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact' })

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (['Completed', 'Delivered'].includes(status)) return 'success'
  if (['Ongoing', 'In Transit'].includes(status)) return 'warning'
  if (status === 'Cancelled') return 'danger'
  return 'neutral'
}

function alertTone(severity: string): 'danger' | 'warning' | 'neutral' {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'neutral'
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setError('Could not load dashboard data. Is the API server running?'))
  }, [])

  if (error) {
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-brand-red">{error}</div>
  }
  if (!stats) return <LoadingScreen />

  const maxTrend = Math.max(1, ...stats.revenueTrend.map((d) => d.revenue))
  const statusTotal = stats.bookingStatusDistribution.reduce((sum, s) => sum + s.value, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Dashboard</h1>
        <p className="text-sm text-navy-400">Platform overview across Ride and Transport services.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Customers" value={compact.format(stats.totals.customers)} icon={Users} accent="navy" />
        <StatCard label="Riders" value={compact.format(stats.totals.riders)} icon={Bike} accent="orange" />
        <StatCard label="Transport Riders" value={compact.format(stats.totals.drivers)} icon={CarFront} accent="orange" />
        <StatCard label="Transport Partners" value={compact.format(stats.totals.transportPartners)} icon={Building2} accent="green" />
        <StatCard label="Vehicles" value={compact.format(stats.totals.vehicles)} icon={CarFront} accent="navy" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Today's Bookings" value={compact.format(stats.today.bookings)} icon={ListChecks} accent="navy" />
        <StatCard label="Ongoing Rides" value={String(stats.today.ongoingRides)} icon={Clock} accent="orange" />
        <StatCard label="Active Deliveries" value={String(stats.today.activeDeliveries)} icon={CarFront} accent="orange" />
        <StatCard label="Completed" value={compact.format(stats.today.completed)} icon={ListChecks} accent="green" />
        <StatCard label="Cancelled" value={String(stats.today.cancelled)} icon={AlertTriangle} accent="red" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={currency.format(stats.revenue.todayRevenue)} icon={IndianRupee} accent="green" />
        <StatCard label="Platform Commission" value={currency.format(stats.revenue.platformCommission)} icon={IndianRupee} accent="navy" />
        <StatCard label="Partner/Rider Earnings" value={currency.format(stats.revenue.partnerEarnings)} icon={IndianRupee} accent="orange" />
        <StatCard label="Refunds" value={currency.format(stats.revenue.refunds)} icon={IndianRupee} accent="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-navy-800">Revenue trend (7 days)</h2>
          <div className="mt-4 flex h-40 items-end gap-3">
            {stats.revenueTrend.map((d) => (
              <div key={d.day} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-navy-500"
                  style={{ height: `${Math.max(6, (d.revenue / maxTrend) * 100)}%` }}
                  title={currency.format(d.revenue)}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {stats.revenueTrend.map((d) => (
              <span key={d.day} className="flex-1 text-center text-xs text-navy-300">
                {d.day}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy-800">Ride vs Transport</h2>
          <div className="mt-4 space-y-3">
            {stats.serviceSplit.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-xs text-navy-400">
                  <span>{s.label}</span>
                  <span>{s.value}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-navy-50">
                  <div
                    className={s.label === 'Ride' ? 'h-full bg-navy-500' : 'h-full bg-brand-orange'}
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-semibold text-navy-800">Booking status</h2>
          <div className="mt-3 space-y-2">
            {stats.bookingStatusDistribution.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-navy-500">{s.label}</span>
                <span className="text-navy-400">{statusTotal ? Math.round((s.value / statusTotal) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-navy-800">Recent bookings</h2>
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy-300">
                <th className="pb-2 font-medium">Booking</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Fare</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-navy-300">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {stats.recentBookings.map((b) => (
                <tr key={b.id} className="border-b border-navy-50 last:border-0">
                  <td className="py-2.5 font-medium text-navy-700">{b.id}</td>
                  <td className="py-2.5 text-navy-500">{b.customer}</td>
                  <td className="py-2.5 text-navy-500">
                    {b.mode} · {b.category}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </td>
                  <td className="py-2.5 text-right text-navy-700">{b.fare ? currency.format(b.fare) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-navy-800">Pending approvals</h2>
            <div className="space-y-2.5">
              {stats.pendingApprovals.length === 0 && <p className="text-sm text-navy-300">Nothing waiting for approval.</p>}
              {stats.pendingApprovals.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-navy-700">{a.name}</p>
                    <p className="text-xs text-navy-300">{a.type}</p>
                  </div>
                  <Badge tone="warning">Pending</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-navy-800">Alerts</h2>
            <div className="space-y-2.5">
              {stats.alerts.length === 0 && <p className="text-sm text-navy-300">No active alerts.</p>}
              {stats.alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                  <div>
                    <p className="text-navy-700">{a.message}</p>
                    <Badge tone={alertTone(a.severity)}>{a.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
