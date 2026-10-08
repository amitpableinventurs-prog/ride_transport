import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, Search } from 'lucide-react'
import { fetchCustomers, updateCustomer } from '@/api/customers'
import type { Customer, UserStatus } from '@/types/entities'
import { CustomerDetailModal } from './CustomerDetailModal'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const STATUS_TONE: Record<UserStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  suspended: 'warning',
  blocked: 'danger',
}

const LIMIT = 20

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)

  async function load() {
    const data = await fetchCustomers({ page, limit: LIMIT, q: q || undefined, status: statusFilter || undefined })
    setCustomers(data.items)
    setTotal(data.total)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setError('Could not load customers.'))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, statusFilter])

  async function changeStatus(customer: Customer, status: UserStatus) {
    setBusyId(customer.id)
    try {
      const updated = await updateCustomer(customer.id, { status })
      setCustomers((prev) => prev!.map((c) => (c.id === customer.id ? updated : c)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Customers</h1>
        <p className="text-sm text-navy-400">View and manage rider &amp; delivery customer accounts.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            value={q}
            onChange={(e) => {
              setPage(1)
              setQ(e.target.value)
            }}
            placeholder="Search name, email or phone"
            className="w-72 rounded-lg border border-navy-100 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1)
            setStatusFilter(e.target.value as UserStatus | '')
          }}
          className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!customers ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Bookings</th>
                  <th className="px-5 py-3 font-medium">Rating</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No customers found.
                    </td>
                  </tr>
                )}
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3">
                      <button onClick={() => setViewing(customer)} className="text-left font-medium text-navy-800 hover:text-brand-orange hover:underline">
                        {customer.name || 'No name yet'}
                      </button>
                      <p className="text-xs text-navy-300">{customer.email}</p>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{customer.phone}</td>
                    <td className="px-5 py-3 text-navy-600">{customer.city ?? '—'}</td>
                    <td className="px-5 py-3">
                      <PermissionGate
                        permission="users.manage"
                        fallback={<Badge tone={STATUS_TONE[customer.status]}>{customer.status}</Badge>}
                      >
                        <select
                          value={customer.status}
                          disabled={busyId === customer.id}
                          onChange={(e) => changeStatus(customer, e.target.value as UserStatus)}
                          className="rounded-lg border border-navy-100 bg-white px-2 py-1 text-sm text-navy-700 disabled:opacity-60"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </PermissionGate>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{customer.totalBookings}</td>
                    <td className="px-5 py-3 text-navy-600">{customer.rating.toFixed(1)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setViewing(customer)}
                        className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                      >
                        <Eye size={13} /> View
                      </button>
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
        <CustomerDetailModal
          customer={viewing}
          onClose={() => setViewing(null)}
          onUpdated={(updated) => {
            setViewing(updated)
            setCustomers((prev) => prev!.map((c) => (c.id === updated.id ? updated : c)))
          }}
        />
      )}
    </div>
  )
}
