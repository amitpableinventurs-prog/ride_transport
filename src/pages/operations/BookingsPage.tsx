import { useEffect, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { assignBookingDriver, fetchAvailableDrivers, fetchBooking, fetchBookings, updateBookingStatus } from '@/api/bookings'
import type { AvailableDriver, Booking, BookingStatus, ServiceMode } from '@/types/booking'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const ALL_STATUSES: BookingStatus[] = [
  'scheduled',
  'requested',
  'no_rider_found',
  'accepted',
  'arriving',
  'arrived',
  'started',
  'in_transit',
  'completed',
  'cancelled',
]
const FARE_LINES: (keyof Booking['fare'])[] = ['base', 'distance', 'time', 'waiting', 'night', 'extraStops', 'loading', 'platformFee', 'tax', 'discount']

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

function statusTone(status: string): BadgeTone {
  if (status === 'completed') return 'success'
  if (status === 'cancelled' || status === 'no_rider_found') return 'danger'
  if (status === 'requested' || status === 'scheduled') return 'neutral'
  if (status === 'accepted' || status === 'arriving' || status === 'arrived') return 'info'
  return 'warning'
}

function paymentTone(status: string): BadgeTone {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function personLabel(value: Booking['customer'] | Booking['driver'], fallback = '—'): string {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value.name || fallback
}

function vehicleLabel(vehicle: Booking['vehicle']): string {
  if (!vehicle) return '—'
  if (typeof vehicle === 'string') return vehicle
  return vehicle.registrationNumber
}

function errorMessage(err: unknown, fallback: string): string {
  const maybe = err as { response?: { data?: { message?: string } } }
  return maybe.response?.data?.message ?? fallback
}

interface BookingsListViewProps {
  title: string
  subtitle: string
  fixedMode?: ServiceMode
  fixedStatus?: string
  showModeFilter?: boolean
  showStatusFilter?: boolean
}

export function BookingsListView({
  title,
  subtitle,
  fixedMode,
  fixedStatus,
  showModeFilter = true,
  showStatusFilter = true,
}: BookingsListViewProps) {
  const [items, setItems] = useState<Booking[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<'' | ServiceMode>('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const limit = 20

  useEffect(() => {
    let cancelled = false
    fetchBookings({
      mode: fixedMode ?? (mode || undefined),
      status: fixedStatus ?? (status || undefined),
      paymentStatus: paymentStatus || undefined,
      q: search.trim() || undefined,
      page,
      limit,
    })
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load bookings.')
      })
    return () => {
      cancelled = true
    }
  }, [mode, status, paymentStatus, search, page, fixedMode, fixedStatus])

  function reload() {
    fetchBookings({
      mode: fixedMode ?? (mode || undefined),
      status: fixedStatus ?? (status || undefined),
      paymentStatus: paymentStatus || undefined,
      q: search.trim() || undefined,
      page,
      limit,
    })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch(() => setError('Could not load bookings.'))
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">{title}</h1>
        <p className="text-sm text-navy-400">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showModeFilter && (
          <select
            value={mode}
            onChange={(e) => {
              setPage(1)
              setMode(e.target.value as '' | ServiceMode)
            }}
            className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700"
          >
            <option value="">All modes</option>
            <option value="ride">Ride</option>
            <option value="transport">Transport</option>
          </select>
        )}
        {showStatusFilter && (
          <select
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value)
            }}
            className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPage(1)
            setPaymentStatus(e.target.value)
          }}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700"
        >
          <option value="">All payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="Search booking code…"
            className="rounded-lg border border-navy-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
          />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!items ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium text-right">Fare</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className="cursor-pointer border-b border-navy-50 last:border-0 hover:bg-navy-50/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-800">{b.bookingCode}</p>
                      <p className="text-xs text-navy-300">
                        {b.mode} · {b.categoryKey}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{personLabel(b.customer)}</td>
                    <td className="px-5 py-3 text-navy-600">{personLabel(b.driver, 'Unassigned')}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={paymentTone(b.paymentStatus)}>{b.paymentStatus}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-navy-700">{currency.format(b.fare?.total ?? 0)}</td>
                    <td className="px-5 py-3 text-navy-500">{dateFmt.format(new Date(b.createdAt))}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No bookings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-navy-500">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-navy-100 px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-navy-100 px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedId && <BookingDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} />}
    </div>
  )
}

function BookingDetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBooking(id)
      .then((data) => {
        if (!cancelled) setBooking(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load booking detail.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <Modal title={booking ? `Booking ${booking.bookingCode}` : 'Booking detail'} onClose={onClose}>
      {!booking ? (
        error ? <p className="text-sm text-brand-red">{error}</p> : <p className="text-sm text-navy-400">Loading…</p>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
            <Badge tone={paymentTone(booking.paymentStatus)}>{booking.paymentStatus}</Badge>
            <span className="text-xs text-navy-400">
              {booking.mode} · {booking.categoryKey}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-navy-400">Customer</p>
              <p className="text-navy-800">{personLabel(booking.customer)}</p>
            </div>
            <div>
              <p className="text-xs text-navy-400">Driver</p>
              <p className="text-navy-800">{personLabel(booking.driver, 'Unassigned')}</p>
            </div>
            <div>
              <p className="text-xs text-navy-400">Vehicle</p>
              <p className="text-navy-800">{vehicleLabel(booking.vehicle)}</p>
            </div>
            <div>
              <p className="text-xs text-navy-400">Distance / Duration</p>
              <p className="text-navy-800">
                {booking.distanceKm} km · {booking.durationMin} min
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-navy-400">Pickup</p>
              <p className="text-navy-800">{booking.pickup?.address ?? '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-navy-400">Drop</p>
              <p className="text-navy-800">{booking.drop?.address ?? '—'}</p>
            </div>
            {booking.goodsDetails?.description && (
              <div className="col-span-2">
                <p className="text-xs text-navy-400">Goods</p>
                <p className="text-navy-800">
                  {booking.goodsDetails.description}
                  {booking.goodsDetails.weightKg ? ` · ${booking.goodsDetails.weightKg} kg` : ''}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-navy-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Fare breakdown</p>
            <div className="space-y-1 text-sm text-navy-600">
              {FARE_LINES.map((k) => (
                <div key={k} className="flex justify-between capitalize">
                  <span>{String(k).replace(/([A-Z])/g, ' $1')}</span>
                  <span>{currency.format(booking.fare?.[k] ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-navy-100 pt-1 font-semibold text-navy-800">
                <span>Total</span>
                <span>{currency.format(booking.fare?.total ?? 0)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Timeline</p>
            <div className="space-y-2">
              {booking.timeline?.length ? (
                booking.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" />
                    <div>
                      <p className="text-navy-700">
                        {t.status}
                        {t.note ? ` — ${t.note}` : ''}
                      </p>
                      <p className="text-xs text-navy-300">{dateFmt.format(new Date(t.at))}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-navy-300">No timeline entries yet.</p>
              )}
            </div>
          </div>

          <PermissionGate permission="bookings.manage">
            <div className="space-y-3 border-t border-navy-100 pt-3">
              {booking.status === 'requested' && !booking.driver && (
                <AssignDriverControl
                  booking={booking}
                  onAssigned={(updated) => {
                    setBooking(updated)
                    onChanged()
                  }}
                />
              )}
              <StatusChangeControl
                booking={booking}
                onChanged={(updated) => {
                  setBooking(updated)
                  onChanged()
                }}
              />
            </div>
          </PermissionGate>
        </div>
      )}
    </Modal>
  )
}

function AssignDriverControl({ booking, onAssigned }: { booking: Booking; onAssigned: (b: Booking) => void }) {
  const [drivers, setDrivers] = useState<AvailableDriver[] | null>(null)
  const [driverId, setDriverId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAvailableDrivers(booking.mode, booking.categoryKey)
      .then((data) => {
        if (!cancelled) setDrivers(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load available drivers.')
      })
    return () => {
      cancelled = true
    }
  }, [booking.mode, booking.categoryKey])

  async function handleAssign() {
    if (!driverId) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await assignBookingDriver(booking.id, { driverId })
      onAssigned(updated)
    } catch (err) {
      setError(errorMessage(err, 'Could not assign driver'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-navy-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Assign driver</p>
      {error && <p className="mb-2 text-xs text-brand-red">{error}</p>}
      {!drivers ? (
        <p className="text-sm text-navy-300">Loading drivers…</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-navy-300">No online drivers available right now.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700"
          >
            <option value="">Select driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.phone})
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!driverId || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-50"
          >
            <UserPlus size={14} /> Assign
          </button>
        </div>
      )}
    </div>
  )
}

function StatusChangeControl({ booking, onChanged }: { booking: Booking; onChanged: (b: Booking) => void }) {
  const [status, setStatus] = useState<BookingStatus>(booking.status)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTerminal = booking.status === 'completed' || booking.status === 'cancelled'

  async function handleUpdate() {
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateBookingStatus(booking.id, {
        status,
        note: note.trim() || undefined,
        ...(status === 'cancelled' ? { cancelledBy: 'admin' as const, reason: note.trim() || 'Cancelled by admin' } : {}),
      })
      onChanged(updated)
      setNote('')
    } catch (err) {
      setError(errorMessage(err, 'Could not update status'))
    } finally {
      setSubmitting(false)
    }
  }

  if (isTerminal) return null

  return (
    <div className="rounded-xl border border-navy-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Update status</p>
      {error && <p className="mb-2 text-xs text-brand-red">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BookingStatus)}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note / reason (optional)"
          className="min-w-[180px] flex-1 rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
        />
        <button
          onClick={handleUpdate}
          disabled={submitting}
          className="rounded-lg bg-navy-500 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
        >
          Update
        </button>
      </div>
    </div>
  )
}

export function BookingsPage() {
  return <BookingsListView title="Bookings" subtitle="All ride and transport bookings across the platform." />
}
