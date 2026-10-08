import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, Trash2, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, XCircle } from 'lucide-react'
import { deleteDriver, fetchDrivers, updateDriver } from '@/api/drivers'
import type { ApprovalStatus, Driver, OnlineStatus, UserStatus } from '@/types/entities'
import { DriverDetailModal } from './DriverDetailModal'
import { IconButton } from '@/components/common/IconButton'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const STATUS_TONE: Record<UserStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  suspended: 'warning',
  blocked: 'danger',
}

const APPROVAL_TONE: Record<ApprovalStatus, 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
}

const ONLINE_TONE: Record<OnlineStatus, 'success' | 'info' | 'neutral'> = {
  online: 'success',
  on_trip: 'info',
  busy: 'info',
  offline: 'neutral',
}

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const LIMIT = 20

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Driver | null>(null)

  async function load() {
    const data = await fetchDrivers({ page, limit: LIMIT, q: q || undefined, serviceType: 'transport' })
    setDrivers(data.items)
    setTotal(data.total)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setError('Could not load drivers.'))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  async function apply(driver: Driver, patch: Partial<{ approvalStatus: ApprovalStatus; status: UserStatus }>) {
    setBusyId(driver.id)
    try {
      const updated = await updateDriver(driver.id, patch)
      setDrivers((prev) => prev!.map((d) => (d.id === driver.id ? updated : d)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(driver: Driver) {
    const who = driver.name || driver.phone
    const ok = window.confirm(
      `Delete ${who}?\n\nThis permanently removes the account with its vehicles, documents and wallet. Past trips stay in the bookings history. This cannot be undone.`,
    )
    if (!ok) return
    setBusyId(driver.id)
    setError(null)
    try {
      await deleteDriver(driver.id)
      setDrivers((prev) => prev!.filter((d) => d.id !== driver.id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete driver'
      setError(message)
      window.alert(message)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Transport Riders</h1>
        <p className="text-sm text-navy-400">Riders doing goods delivery (Bike Porter, Small Vehicles).</p>
      </div>

      <div className="relative w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
        <input
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
          placeholder="Search name, email or phone"
          className="w-full rounded-lg border border-navy-100 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!drivers ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Rider</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Approval</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Online</th>
                  <th className="px-5 py-3 font-medium">Rating</th>
                  <th className="px-5 py-3 font-medium">Trips</th>
                  <th className="px-5 py-3 font-medium">Earnings</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-8 text-center text-navy-300">
                      No transport riders found.
                    </td>
                  </tr>
                )}
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">
                      <button onClick={() => setViewing(driver)} className="text-left hover:text-brand-orange hover:underline">
                        {driver.name || driver.phone}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{driver.phone}</td>
                    <td className="px-5 py-3 text-navy-600">
                      {driver.assignedVehicle && typeof driver.assignedVehicle === 'object'
                        ? `${driver.assignedVehicle.registrationNumber} · ${driver.assignedVehicle.model}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={APPROVAL_TONE[driver.approvalStatus]}>{driver.approvalStatus}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[driver.status]}>{driver.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ONLINE_TONE[driver.onlineStatus]}>{driver.onlineStatus}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{driver.rating.toFixed(1)}</td>
                    <td className="px-5 py-3 text-navy-600">{driver.totalTrips}</td>
                    <td className="px-5 py-3 text-navy-600">{moneyFmt.format(driver.earnings)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton label="View details and documents" icon={Eye} onClick={() => setViewing(driver)} />
                        <PermissionGate permission="users.manage">
                          {driver.approvalStatus === 'pending' && (
                            <>
                              <IconButton
                                label="Approve"
                                tone="success"
                                icon={CheckCircle2}
                                disabled={busyId === driver.id}
                                onClick={() => apply(driver, { approvalStatus: 'verified' })}
                              />
                              <IconButton label="Reject (asks for a reason)" tone="danger" icon={XCircle} onClick={() => setViewing(driver)} />
                            </>
                          )}
                          <IconButton
                            label={driver.status === 'active' ? 'Suspend' : 'Activate'}
                            icon={driver.status === 'active' ? ShieldOff : ShieldCheck}
                            disabled={busyId === driver.id}
                            onClick={() => apply(driver, { status: driver.status === 'active' ? 'suspended' : 'active' })}
                          />
                          <IconButton label="Delete" tone="danger" icon={Trash2} disabled={busyId === driver.id} onClick={() => remove(driver)} />
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-navy-400">
            <span>
              Page {page} of {totalPages} &middot; {total} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-navy-100 p-1.5 hover:bg-navy-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-navy-100 p-1.5 hover:bg-navy-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {viewing && (
        <DriverDetailModal
          driver={viewing}
          label="Transport rider"
          onClose={() => setViewing(null)}
          onUpdated={(updated) => {
            setViewing(updated)
            setDrivers((prev) => prev!.map((d) => (d.id === updated.id ? updated : d)))
          }}
        />
      )}
    </div>
  )
}
