import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CheckCircle2, Pencil, XCircle } from 'lucide-react'
import { updateVehicle } from '@/api/vehicles'
import { fetchVehicleTypes } from '@/api/vehicleTypes'
import type { DocumentRecord, Vehicle, VehicleType } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { PermissionGate } from '@/components/common/PermissionGate'
import { DocumentReviewPanel, unverifiedCount, type DocumentSource } from '@/components/documents/DocumentReviewPanel'

const INPUT = 'w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400'
const STATUS_TONE = { active: 'success', inactive: 'neutral', blocked: 'danger' } as const
const DOC_TONE = { verified: 'success', pending: 'warning', rejected: 'danger', expired: 'danger' } as const

/** Review screen for a vehicle: details, its documents (RC etc.), then approve or reject. */
export function VehicleDetailModal({
  vehicle,
  onClose,
  onUpdated,
}: {
  vehicle: Vehicle
  onClose: () => void
  onUpdated: (vehicle: Vehicle) => void
}) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState(vehicle.model)
  const [manufacturer, setManufacturer] = useState(vehicle.manufacturer ?? '')
  const [capacity, setCapacity] = useState(vehicle.capacity ?? '')
  const currentTypeId = typeof vehicle.vehicleType === 'string' ? vehicle.vehicleType : vehicle.vehicleType.id
  const [typeId, setTypeId] = useState(currentTypeId)
  const [types, setTypes] = useState<VehicleType[]>([])

  useEffect(() => {
    if (editing && types.length === 0) fetchVehicleTypes({ limit: 100 }).then((r) => setTypes(r.items)).catch(() => setError('Could not load vehicle types'))
  }, [editing, types.length])

  // The rider app files a driver's RC under the driver, so look there as well as under the vehicle itself.
  const sources: DocumentSource[] = [{ ownerType: 'vehicle', ownerId: vehicle.id }]
  if (vehicle.ownerType === 'driver') sources.push({ ownerType: 'driver', ownerId: vehicle.ownerId, docTypes: ['vehicle_rc'] })

  const pendingDocs = unverifiedCount(docs)
  const vehicleType = typeof vehicle.vehicleType === 'string' ? vehicle.vehicleType : vehicle.vehicleType.name

  async function save(patch: Parameters<typeof updateVehicle>[1], after?: () => void) {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateVehicle(vehicle.id, patch)
      // The update response is the raw vehicle, so keep the display-only fields from the list row.
      const newType = types.find((t) => t.id === updated.vehicleType) ?? vehicle.vehicleType
      onUpdated({ ...vehicle, ...updated, vehicleType: newType, ownerLabel: vehicle.ownerLabel, assignedDriver: vehicle.assignedDriver })
      after?.()
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  function submitEdit(e: FormEvent) {
    e.preventDefault()
    save({ model, manufacturer, capacity, ...(typeId !== currentTypeId ? { vehicleType: typeId } : {}) }, () => setEditing(false))
  }

  return (
    <Modal title={`Vehicle: ${vehicle.registrationNumber}`} onClose={onClose} wide>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-400">Details</h4>
            <PermissionGate permission="fleet.manage">
              {!editing && (
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-navy-500 hover:text-brand-orange">
                  <Pencil size={12} /> Edit
                </button>
              )}
            </PermissionGate>
          </div>

          {editing ? (
            <form onSubmit={submitEdit} className="grid gap-3 sm:grid-cols-2">
              <Field label="Model">
                <input required value={model} onChange={(e) => setModel(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Manufacturer">
                <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Vehicle type">
                <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={INPUT}>
                  {types.length === 0 && <option value={typeId}>{vehicleType}</option>}
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.serviceMode}){t.status === 'inactive' ? ' - inactive' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity">
                <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className={INPUT} />
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
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Item label="Registration" value={vehicle.registrationNumber} />
              <Item label="Model" value={vehicle.model} />
              <Item label="Manufacturer" value={vehicle.manufacturer || '—'} />
              <Item label="Vehicle type" value={vehicleType} />
              <Item label="Service mode" value={vehicle.serviceMode} />
              <Item label="Capacity" value={vehicle.capacity || '—'} />
              <Item label="Owner" value={vehicle.ownerLabel ?? '—'} />
              <Item label="Assigned driver" value={vehicle.assignedDriver ? `${vehicle.assignedDriver.name} (${vehicle.assignedDriver.phone})` : 'Unassigned'} />
              <div>
                <dt className="text-xs text-navy-400">Status</dt>
                <dd className="mt-0.5">
                  <Badge tone={STATUS_TONE[vehicle.status]}>{vehicle.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-navy-400">Documents</dt>
                <dd className="mt-0.5">
                  <Badge tone={DOC_TONE[vehicle.documentsStatus]}>{vehicle.documentsStatus}</Badge>
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Documents</h4>
          <DocumentReviewPanel
            sources={sources}
            onLoaded={(d) => {
              setDocs(d)
              // Document reviews keep the vehicle's documents status in step on the server; mirror it here.
              if (d.length && d.every((x) => x.status === 'verified') && vehicle.documentsStatus !== 'verified') onUpdated({ ...vehicle, documentsStatus: 'verified' })
              else if (d.some((x) => x.status === 'rejected') && vehicle.documentsStatus !== 'rejected') onUpdated({ ...vehicle, documentsStatus: 'rejected' })
            }}
          />
        </section>

        <PermissionGate permission="fleet.manage">
          <section className="rounded-xl bg-navy-50 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Approval</h4>
            {pendingDocs !== null && pendingDocs > 0 && vehicle.status !== 'active' && (
              <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-brand-orange-dark">
                {docs!.length === 0 ? 'No documents have been uploaded.' : `${pendingDocs} of ${docs!.length} documents are not verified yet.`} Review them above before approving.
              </p>
            )}
            <div className="flex gap-2">
              {vehicle.status !== 'active' && (
                <button
                  onClick={() => save({ status: 'active', ...(pendingDocs === 0 && docs!.length > 0 ? { documentsStatus: 'verified' as const } : {}) })}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <CheckCircle2 size={15} /> Approve vehicle
                </button>
              )}
              {vehicle.status === 'active' && (
                <button
                  onClick={() => save({ status: 'inactive' })}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-4 py-2 text-sm font-medium text-brand-red disabled:opacity-60"
                >
                  <XCircle size={15} /> Deactivate
                </button>
              )}
            </div>
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
