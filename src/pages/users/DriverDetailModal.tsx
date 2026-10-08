import { useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Pencil, XCircle } from 'lucide-react'
import { updateDriver } from '@/api/drivers'
import { fileHref } from '@/api/files'
import type { Driver, DocumentRecord } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { PermissionGate } from '@/components/common/PermissionGate'
import { DocumentReviewPanel, unverifiedCount } from '@/components/documents/DocumentReviewPanel'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const INPUT = 'w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400'
const APPROVAL_TONE = { verified: 'success', pending: 'warning', rejected: 'danger' } as const

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

/** Review screen for a rider or driver: profile, uploaded documents, then approve or reject. */
export function DriverDetailModal({
  driver,
  label,
  onClose,
  onUpdated,
}: {
  driver: Driver
  label: 'Rider' | 'Driver'
  onClose: () => void
  onUpdated: (driver: Driver) => void
}) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(driver.name)
  const [email, setEmail] = useState(driver.email ?? '')
  const [gender, setGender] = useState(driver.gender ?? '')
  const [dob, setDob] = useState(driver.dateOfBirth ? driver.dateOfBirth.slice(0, 10) : '')

  const pendingDocs = unverifiedCount(docs)
  const vehicle = driver.assignedVehicle && typeof driver.assignedVehicle === 'object' ? driver.assignedVehicle : null

  async function save(patch: Parameters<typeof updateDriver>[1], after?: () => void) {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await updateDriver(driver.id, patch))
      after?.()
    } catch (err) {
      setError(errorMessage(err, 'Action failed'))
    } finally {
      setBusy(false)
    }
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault()
    save(
      { name, email, ...(gender ? { gender: gender as 'male' | 'female' | 'other' } : {}), ...(dob ? { dateOfBirth: dob } : {}) },
      () => setEditing(false),
    )
  }

  return (
    <Modal title={`${label}: ${driver.name || driver.phone}`} onClose={onClose} wide>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-400">Profile</h4>
            <PermissionGate permission="users.manage">
              {!editing && (
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-brand-orange">
                  <Pencil size={12} /> Edit
                </button>
              )}
            </PermissionGate>
          </div>

          {editing ? (
            <form onSubmit={submitEdit} className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Gender">
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={INPUT}>
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Date of birth">
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={INPUT} />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={busy} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  Save changes
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-navy-100 px-4 py-2 text-sm text-navy-600">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-4">
              {driver.photoUrl && <img src={fileHref(driver.photoUrl)} alt="" className="h-20 w-20 rounded-xl border border-navy-100 object-cover" />}
              <dl className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Item label="Name" value={driver.name || '—'} />
                <Item label="Phone" value={driver.phone} />
                <Item label="Email" value={driver.email || '—'} />
                <Item label="Gender" value={driver.gender ?? '—'} />
                <Item label="Date of birth" value={driver.dateOfBirth ? dateFmt.format(new Date(driver.dateOfBirth)) : '—'} />
                <Item label="Vehicle" value={vehicle ? `${vehicle.registrationNumber} · ${vehicle.model}` : '—'} />
                <Item label="Joined" value={dateFmt.format(new Date(driver.createdAt))} />
                <div>
                  <dt className="text-xs text-navy-400">Approval</dt>
                  <dd className="mt-0.5">
                    <Badge tone={APPROVAL_TONE[driver.approvalStatus]}>{driver.approvalStatus}</Badge>
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {driver.approvalStatus === 'rejected' && driver.rejectionReason && (
            <p className="mt-2 text-xs text-brand-red">Rejected: {driver.rejectionReason}</p>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Documents</h4>
          <DocumentReviewPanel sources={[{ ownerType: 'driver', ownerId: driver.id }]} onLoaded={setDocs} />
        </section>

        <PermissionGate permission="users.manage">
          <section className="rounded-xl bg-navy-50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Approval</h4>
            {pendingDocs !== null && pendingDocs > 0 && driver.approvalStatus !== 'verified' && (
              <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-brand-orange-dark">
                {docs!.length === 0 ? 'No documents have been uploaded.' : `${pendingDocs} of ${docs!.length} documents are not verified yet.`} Review them above before approving.
              </p>
            )}
            {rejecting ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason shown to the user in the app"
                  className="min-w-0 flex-1 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm outline-none focus:border-navy-400"
                />
                <button
                  disabled={!reason.trim() || busy}
                  onClick={() => save({ approvalStatus: 'rejected', rejectionReason: reason.trim() }, () => setRejecting(false))}
                  className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Reject {label.toLowerCase()}
                </button>
                <button onClick={() => setRejecting(false)} className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-600">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {driver.approvalStatus !== 'verified' && (
                  <button
                    onClick={() => save({ approvalStatus: 'verified' })}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} /> Approve {label.toLowerCase()}
                  </button>
                )}
                {driver.approvalStatus !== 'rejected' && (
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-4 py-2 text-sm font-medium text-brand-red disabled:opacity-60"
                  >
                    <XCircle size={15} /> Reject
                  </button>
                )}
                {driver.approvalStatus === 'verified' && <p className="py-2 text-sm text-brand-green-dark">This {label.toLowerCase()} is approved.</p>}
              </div>
            )}
          </section>
        </PermissionGate>
      </div>
    </Modal>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-navy-400">{label}</dt>
      <dd className="text-navy-800">{value}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-navy-600">{label}</label>
      {children}
    </div>
  )
}
