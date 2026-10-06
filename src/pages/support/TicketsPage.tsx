import { useEffect, useState, type FormEvent } from 'react'
import { Eye } from 'lucide-react'
import { fetchTickets, updateTicket as updateTicketApi } from '@/api/tickets'
import { fetchAdminUsers } from '@/api/adminUsers'
import type { AdminUser } from '@/types/rbac'
import type { Ticket, TicketCategory, TicketStatus, TicketPriority } from '@/types/marketing'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { useAuthStore } from '@/store/authStore'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function errMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  payment: 'Payment',
  booking: 'Booking',
  driver: 'Driver',
  vehicle: 'Vehicle',
  lost_item: 'Lost item',
  refund: 'Refund',
  cancellation: 'Cancellation',
  technical: 'Technical',
}

const STATUS_TONE: Record<TicketStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  open: 'warning',
  assigned: 'info',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
}

const PRIORITY_TONE: Record<TicketPriority, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
}

function assignedName(ticket: Ticket) {
  if (!ticket.assignedTo) return null
  return typeof ticket.assignedTo === 'string' ? ticket.assignedTo : ticket.assignedTo.name
}

interface TicketsManagerProps {
  title?: string
  subtitle?: string
}

export function TicketsManager({
  title = 'Tickets',
  subtitle = 'Support tickets raised by customers, drivers and partners.',
}: TicketsManagerProps) {
  const canManage = useAuthStore((s) => s.hasPermission('support.manage'))
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Ticket | null>(null)

  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    const [t, a] = await Promise.all([
      fetchTickets({ category: category || undefined, status: status || undefined, priority: priority || undefined, q: q || undefined }),
      admins.length ? Promise.resolve(admins) : fetchAdminUsers(),
    ])
    setTickets(t)
    if (!admins.length) setAdmins(a)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load tickets.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status, priority])

  function applySearch(e: FormEvent) {
    e.preventDefault()
    load().catch(() => setError('Could not load tickets.'))
  }

  function handleUpdated(updated: Ticket) {
    setTickets((prev) => (prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev))
    setActive(updated)
  }

  if (!tickets) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">{title}</h1>
        <p className="text-sm text-navy-400">{subtitle}</p>
      </div>

      <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">All</option>
            {(['open', 'assigned', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
            <option value="">All</option>
            {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Subject or raised by…" className="input" />
        </label>
        <button type="submit" className="rounded-lg border border-navy-100 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-50">
          Filter
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Raised by</th>
              <th className="px-5 py-3 font-medium">Priority</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Assigned to</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800">{ticket.subject}</td>
                <td className="px-5 py-3 text-navy-600">{CATEGORY_LABELS[ticket.category]}</td>
                <td className="px-5 py-3 text-navy-600">
                  {ticket.raisedByName}
                  <span className="ml-1 text-xs text-navy-300">({ticket.raisedByType})</span>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-600">{assignedName(ticket) ?? <span className="text-navy-300">Unassigned</span>}</td>
                <td className="px-5 py-3 text-navy-500">{dateFmt.format(new Date(ticket.createdAt))}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setActive(ticket)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                  >
                    <Eye size={14} /> View
                  </button>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-navy-300">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {active && (
        <TicketDetailModal ticket={active} admins={admins} canManage={canManage} onClose={() => setActive(null)} onUpdated={handleUpdated} />
      )}
    </div>
  )
}

function TicketDetailModal({
  ticket,
  admins,
  canManage,
  onClose,
  onUpdated,
}: {
  ticket: Ticket
  admins: AdminUser[]
  canManage: boolean
  onClose: () => void
  onUpdated: (t: Ticket) => void
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [assignedTo, setAssignedTo] = useState(typeof ticket.assignedTo === 'object' && ticket.assignedTo ? ticket.assignedTo.id : '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyChange(patch: Partial<{ status: TicketStatus; priority: TicketPriority; assignedTo: string | null; note: string }>) {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateTicketApi(ticket.id, patch)
      onUpdated(updated)
      if (patch.status !== undefined) setStatus(updated.status)
      if (patch.note !== undefined) setNote('')
    } catch (err) {
      setError(errMessage(err, 'Could not update ticket'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={ticket.subject} onClose={onClose}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium text-navy-400">Raised by</p>
            <p className="text-navy-700">
              {ticket.raisedByName} ({ticket.raisedByType})
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-navy-400">Category</p>
            <p className="text-navy-700">{CATEGORY_LABELS[ticket.category]}</p>
          </div>
        </div>

        <fieldset disabled={!canManage || saving} className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-600">Status</span>
            <select
              value={status}
              onChange={(e) => {
                const value = e.target.value as TicketStatus
                setStatus(value)
                applyChange({ status: value })
              }}
              className="input"
            >
              {(['open', 'assigned', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-navy-600">Priority</span>
            <select
              value={priority}
              onChange={(e) => {
                const value = e.target.value as TicketPriority
                setPriority(value)
                applyChange({ priority: value })
              }}
              className="input"
            >
              {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block">
            <span className="mb-1.5 block text-xs font-medium text-navy-600">Assigned to</span>
            <select
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value)
                applyChange({ assignedTo: e.target.value || null })
              }}
              className="input"
            >
              <option value="">Unassigned</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <div>
          <p className="mb-2 text-xs font-medium text-navy-600">Notes</p>
          <div className="space-y-2">
            {ticket.notes.length === 0 && <p className="text-sm text-navy-300">No notes yet.</p>}
            {ticket.notes.map((n, idx) => (
              <div key={idx} className="rounded-lg bg-navy-50 px-3 py-2 text-sm">
                <p className="text-navy-700">{n.text}</p>
                <p className="mt-1 text-xs text-navy-300">
                  {n.by} · {dateFmt.format(new Date(n.at))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs font-medium text-navy-600">Add note</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
            </label>
            <button
              type="button"
              disabled={saving || !note.trim()}
              onClick={() => applyChange({ note })}
              className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
            >
              Add
            </button>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
      </div>
    </Modal>
  )
}

export function TicketsPage() {
  return <TicketsManager title="Tickets" subtitle="Support tickets raised by customers, drivers and partners." />
}
