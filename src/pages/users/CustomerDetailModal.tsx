import { useState, type FormEvent, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { updateCustomer } from '@/api/customers'
import { fileHref } from '@/api/files'
import type { Customer, UserStatus } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { PermissionGate } from '@/components/common/PermissionGate'

const INPUT = 'w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400'
const STATUS_TONE = { active: 'success', suspended: 'warning', blocked: 'danger' } as const
const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })

/** Customer profile with saved places and emergency contacts; admins can correct the profile and change status. */
export function CustomerDetailModal({
  customer,
  onClose,
  onUpdated,
}: {
  customer: Customer
  onClose: () => void
  onUpdated: (customer: Customer) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(customer.name)
  const [email, setEmail] = useState(customer.email ?? '')
  const [city, setCity] = useState(customer.city ?? '')
  const [gender, setGender] = useState(customer.gender ?? '')
  const [dob, setDob] = useState(customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '')

  async function save(patch: Parameters<typeof updateCustomer>[1], after?: () => void) {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await updateCustomer(customer.id, patch))
      after?.()
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault()
    save({ name, email, city, ...(gender ? { gender: gender as 'male' | 'female' | 'other' } : {}), ...(dob ? { dateOfBirth: dob } : {}) }, () => setEditing(false))
  }

  const places = customer.savedPlaces ?? []
  const contacts = customer.emergencyContacts ?? []

  return (
    <Modal title={`Customer: ${customer.name || customer.phone}`} onClose={onClose} wide>
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
              <Field label="City">
                <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} />
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
              {customer.photoUrl && <img src={fileHref(customer.photoUrl)} alt="" className="h-20 w-20 rounded-xl border border-navy-100 object-cover" />}
              <dl className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Item label="Name" value={customer.name || '—'} />
                <Item label="Phone" value={customer.phone} />
                <Item label="Email" value={customer.email || '—'} />
                <Item label="City" value={customer.city || '—'} />
                <Item label="Gender" value={customer.gender ?? '—'} />
                <Item label="Date of birth" value={customer.dateOfBirth ? dateFmt.format(new Date(customer.dateOfBirth)) : '—'} />
                <Item label="Bookings" value={String(customer.totalBookings)} />
                <Item label="Rating" value={customer.rating.toFixed(1)} />
                <Item label="Referral code" value={customer.referralCode || '—'} />
                <Item label="Joined" value={dateFmt.format(new Date(customer.createdAt))} />
              </dl>
            </div>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Saved places</h4>
          {places.length === 0 ? (
            <p className="text-sm text-navy-300">None saved.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {places.map((p) => (
                <li key={p.id} className="rounded-lg border border-navy-100 px-3 py-2">
                  <span className="mr-2 text-xs font-medium uppercase text-navy-400">{p.label}</span>
                  <span className="text-navy-800">{p.name ? `${p.name}, ` : ''}{p.address}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Emergency contacts</h4>
          {contacts.length === 0 ? (
            <p className="text-sm text-navy-300">None added.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {contacts.map((c, i) => (
                <li key={i} className="rounded-lg border border-navy-100 px-3 py-2 text-navy-800">
                  {c.name} · {c.phone}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl bg-navy-50 p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Account status</h4>
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[customer.status]}>{customer.status}</Badge>
            <PermissionGate permission="users.manage">
              <select
                value={customer.status}
                disabled={busy}
                onChange={(e) => save({ status: e.target.value as UserStatus })}
                className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm text-navy-700 disabled:opacity-60"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="blocked">Blocked</option>
              </select>
            </PermissionGate>
          </div>
        </section>
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
