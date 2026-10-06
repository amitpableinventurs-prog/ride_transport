import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, XCircle } from 'lucide-react'
import { fetchPartners, updatePartner } from '@/api/partners'
import type { ApprovalStatus, TransportPartner, UserStatus } from '@/types/entities'
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

const LIMIT = 20

export function TransportPartnersPage() {
  const [partners, setPartners] = useState<TransportPartner[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await fetchPartners({ page, limit: LIMIT, q: q || undefined })
    setPartners(data.items)
    setTotal(data.total)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setError('Could not load transport partners.'))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  async function apply(partner: TransportPartner, patch: Partial<{ approvalStatus: ApprovalStatus; status: UserStatus }>) {
    setBusyId(partner.id)
    try {
      const updated = await updatePartner(partner.id, patch)
      setPartners((prev) => prev!.map((p) => (p.id === partner.id ? updated : p)))
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
        <h1 className="text-xl font-semibold text-navy-800">Transport Partners</h1>
        <p className="text-sm text-navy-400">Companies operating fleets of vehicles on the platform.</p>
      </div>

      <div className="relative w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
        <input
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
          placeholder="Search company, owner, email or phone"
          className="w-full rounded-lg border border-navy-100 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!partners ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Approval</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Vehicles</th>
                  <th className="px-5 py-3 font-medium">Drivers</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy-300">
                      No transport partners found.
                    </td>
                  </tr>
                )}
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-800">{partner.companyName}</p>
                      <p className="text-xs text-navy-300">{partner.email}</p>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{partner.ownerName}</td>
                    <td className="px-5 py-3 text-navy-600">{partner.phone}</td>
                    <td className="px-5 py-3">
                      <Badge tone={APPROVAL_TONE[partner.approvalStatus]}>{partner.approvalStatus}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[partner.status]}>{partner.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{partner.vehicleCount}</td>
                    <td className="px-5 py-3 text-navy-600">{partner.driverCount}</td>
                    <td className="px-5 py-3">
                      <PermissionGate permission="users.manage">
                        <div className="flex items-center justify-end gap-1.5">
                          {partner.approvalStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => apply(partner, { approvalStatus: 'verified' })}
                                disabled={busyId === partner.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-green-dark hover:bg-green-50 disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button
                                onClick={() => apply(partner, { approvalStatus: 'rejected' })}
                                disabled={busyId === partner.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50 disabled:opacity-50"
                              >
                                <XCircle size={13} /> Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => apply(partner, { status: partner.status === 'active' ? 'suspended' : 'active' })}
                            disabled={busyId === partner.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                          >
                            {partner.status === 'active' ? (
                              <>
                                <ShieldOff size={13} /> Suspend
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={13} /> Activate
                              </>
                            )}
                          </button>
                        </div>
                      </PermissionGate>
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
    </div>
  )
}
