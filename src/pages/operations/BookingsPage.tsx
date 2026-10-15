import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, Printer, Search, Trash2, UserPlus } from 'lucide-react'
import {
  assignBookingDriver,
  deleteBooking,
  fetchAllBookings,
  fetchAvailableDrivers,
  fetchBooking,
  fetchBookings,
  updateBookingStatus,
  type BookingListParams,
} from '@/api/bookings'
import type { AvailableDriver, Booking, BookingStatus, ServiceMode } from '@/types/booking'
import { Badge } from '@/components/common/Badge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { IconButton } from '@/components/common/IconButton'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Pagination } from '@/components/common/Pagination'
import { PermissionGate } from '@/components/common/PermissionGate'
import { downloadCsv } from '@/lib/csv'
import { openPrintWindow, printTable } from '@/lib/print'

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

function personPhone(value: Booking['customer'] | Booking['driver']): string {
  return value && typeof value !== 'string' ? value.phone : ''
}

// Undeletable while dispatching or on a trip; the server also refuses bookings with money records.
const IN_PROGRESS: BookingStatus[] = ['scheduled', 'requested', 'accepted', 'arriving', 'arrived', 'started', 'in_transit']

/** One flat row per booking for CSV export and print. */
function exportRow(b: Booking): Record<string, string | number> {
  return {
    'Booking code': b.bookingCode,
    Mode: b.mode,
    Category: b.categoryKey,
    Customer: personLabel(b.customer, ''),
    'Customer phone': personPhone(b.customer),
    Driver: personLabel(b.driver, ''),
    'Driver phone': personPhone(b.driver),
    Vehicle: vehicleLabel(b.vehicle),
    Pickup: b.pickup?.address ?? '',
    Drop: b.drop?.address ?? '',
    Status: b.status,
    Payment: b.paymentStatus,
    'Payment method': b.paymentMethod,
    'Fare (INR)': b.fare?.total ?? 0,
    Created: dateFmt.format(new Date(b.createdAt)),
  }
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
  const [limit, setLimit] = useState(20)
  const [mode, setMode] = useState<'' | ServiceMode>('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Booking | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'print' | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const requestId = useRef(0)

  const modeFilter = fixedMode ?? (mode || undefined)
  const statusFilter = fixedStatus ?? (status || undefined)
  const query = search.trim() || undefined
  const filters: Omit<BookingListParams, 'page' | 'limit'> = {
    mode: modeFilter,
    status: statusFilter,
    paymentStatus: paymentStatus || undefined,
    q: query,
  }

  // Only the newest request may fill the table, so fast filter changes can't show stale rows.
  const load = useCallback(() => {
    const id = ++requestId.current
    return fetchBookings({ mode: modeFilter, status: statusFilter, paymentStatus: paymentStatus || undefined, q: query, page, limit })
      .then((data) => {
        if (id !== requestId.current) return
        setItems(data.items)
        setTotal(data.total)
        setError(null)
      })
      .catch(() => {
        if (id === requestId.current) setError('Could not load bookings.')
      })
  }, [modeFilter, statusFilter, paymentStatus, query, page, limit])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  function showNotice(message: string) {
    clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }

  function changeFilter(apply: () => void) {
    setPage(1)
    apply()
  }

  async function confirmDelete(booking: Booking) {
    await deleteBooking(booking.id)
    setDeleting(null)
    showNotice(`Booking ${booking.bookingCode} was deleted.`)
    const remaining = items!.filter((b) => b.id !== booking.id)
    // The row goes at once; then the page is refetched so it fills up again from the next page.
    setItems(remaining)
    setTotal((t) => Math.max(0, t - 1))
    if (remaining.length === 0 && page > 1) setPage((p) => p - 1)
    else load()
  }

  async function exportCsv() {
    setExporting('csv')
    try {
      const all = await fetchAllBookings(filters)
      if (!all.length) {
        showNotice('No bookings to export.')
        return
      }
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      downloadCsv(`${slug}_${new Date().toISOString().slice(0, 10)}`, all.map(exportRow))
    } catch {
      setError('Could not export bookings. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  async function print() {
    // Opened before the fetch: a window opened after an await is blocked as a pop-up.
    const win = openPrintWindow()
    if (!win) {
      setError('Allow pop-ups for this site to print.')
      return
    }
    setExporting('print')
    try {
      const all = await fetchAllBookings(filters)
      const applied = [filters.mode, filters.status, filters.paymentStatus && `payment ${filters.paymentStatus}`, filters.q && `"${filters.q}"`]
        .filter(Boolean)
        .join(' · ')
      printTable(win, { title: `AnZ Cabs — ${title}`, subtitle: `${all.length} bookings${applied ? ` · ${applied}` : ''}`, rows: all.map(exportRow) })
    } catch {
      win.close()
      setError('Could not load bookings for printing. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">{title}</h1>
          <p className="text-sm text-navy-400">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting !== null || total === 0}
            className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
          >
            {exporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export CSV
          </button>
          <button
            type="button"
            onClick={print}
            disabled={exporting !== null || total === 0}
            className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
          >
            {exporting === 'print' ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            Print
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showModeFilter && (
          <select
            value={mode}
            onChange={(e) => changeFilter(() => setMode(e.target.value as '' | ServiceMode))}
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
            onChange={(e) => changeFilter(() => setStatus(e.target.value))}
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
          onChange={(e) => changeFilter(() => setPaymentStatus(e.target.value))}
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
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
            placeholder="Search booking code…"
            className="rounded-lg border border-navy-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
          />
        </div>
      </div>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-brand-green-dark">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!items ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium text-right">Fare</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <PermissionGate permission="bookings.manage">
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </PermissionGate>
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
                    <PermissionGate permission="bookings.manage">
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <IconButton
                            label={IN_PROGRESS.includes(b.status) ? 'Cancel this booking before deleting it' : 'Delete'}
                            tone="danger"
                            icon={Trash2}
                            disabled={IN_PROGRESS.includes(b.status)}
                            onClick={() => setDeleting(b)}
                          />
                        </div>
                      </td>
                    </PermissionGate>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy-300">
                      No bookings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => changeFilter(() => setLimit(size))}
          />
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete booking ${deleting.bookingCode}?`}
          confirmLabel="Delete booking"
          busyLabel="Deleting…"
          onConfirm={() => confirmDelete(deleting)}
          onClose={() => setDeleting(null)}
        >
          <p>
            This permanently removes the booking with its chat and ratings. Bookings with payments, refunds, wallet entries, SOS alerts or
            support tickets cannot be deleted; they are kept for the accounts.
          </p>
          <p className="mt-2 font-medium text-brand-red">This cannot be undone.</p>
        </ConfirmDialog>
      )}

      {selectedId && <BookingDetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
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
