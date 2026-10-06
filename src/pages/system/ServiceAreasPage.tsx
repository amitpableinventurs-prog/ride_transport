import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { fetchServiceAreas, createServiceArea, updateServiceArea } from '@/api/serviceAreas'
import type { ServiceArea } from '@/types/marketing'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Toggle } from '@/components/common/Toggle'

function errMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

function ServiceToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Toggle checked={checked} disabled={disabled} label={label} onChange={onChange} />
      <span className={`w-6 text-xs font-medium ${checked ? 'text-brand-orange-dark' : 'text-navy-300'}`}>{checked ? 'On' : 'Off'}</span>
    </div>
  )
}

export function ServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ServiceArea | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setAreas(await fetchServiceAreas())
  }

  useEffect(() => {
    load().catch(() => setError('Could not load service areas.'))
  }, [])

  async function toggleField(area: ServiceArea, field: 'rideEnabled' | 'transportEnabled') {
    setBusyId(area.id)
    try {
      const updated = await updateServiceArea(area.id, { [field]: !area[field] })
      setAreas((prev) => prev!.map((a) => (a.id === area.id ? updated : a)))
    } catch (err) {
      setError(errMessage(err, 'Could not update service area'))
    } finally {
      setBusyId(null)
    }
  }

  if (!areas) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Service Areas</h1>
          <p className="text-sm text-navy-400">Operational zones where ride and transport services are available.</p>
        </div>
        <PermissionGate permission="settings.manage">
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Service Area
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Location</th>
              <th className="px-5 py-3 font-medium">Zone</th>
              <th className="px-5 py-3 font-medium">Ride</th>
              <th className="px-5 py-3 font-medium">Transport</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800">{area.name}</td>
                <td className="px-5 py-3 text-navy-600">
                  {area.city}, {area.state}, {area.country}
                </td>
                <td className="px-5 py-3 text-navy-500">{area.zone || '—'}</td>
                <td className="px-5 py-3">
                  <PermissionGate permission="settings.manage" fallback={<Badge tone={area.rideEnabled ? 'success' : 'neutral'}>{area.rideEnabled ? 'On' : 'Off'}</Badge>}>
                    <ServiceToggle
                      checked={area.rideEnabled}
                      disabled={busyId === area.id}
                      label={`Ride service in ${area.name}`}
                      onChange={() => toggleField(area, 'rideEnabled')}
                    />
                  </PermissionGate>
                </td>
                <td className="px-5 py-3">
                  <PermissionGate
                    permission="settings.manage"
                    fallback={<Badge tone={area.transportEnabled ? 'success' : 'neutral'}>{area.transportEnabled ? 'On' : 'Off'}</Badge>}
                  >
                    <ServiceToggle
                      checked={area.transportEnabled}
                      disabled={busyId === area.id}
                      label={`Transport service in ${area.name}`}
                      onChange={() => toggleField(area, 'transportEnabled')}
                    />
                  </PermissionGate>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={area.status === 'active' ? 'success' : 'danger'}>{area.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <PermissionGate permission="settings.manage">
                    <button
                      onClick={() => {
                        setEditing(area)
                        setShowForm(true)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
            {areas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-navy-300">
                  No service areas yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ServiceAreaFormModal
          area={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setAreas((prev) => {
              const list = prev ?? []
              const exists = list.some((a) => a.id === saved.id)
              return exists ? list.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...list]
            })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function ServiceAreaFormModal({
  area,
  onClose,
  onSaved,
}: {
  area: ServiceArea | null
  onClose: () => void
  onSaved: (area: ServiceArea) => void
}) {
  const [name, setName] = useState(area?.name ?? '')
  const [country, setCountry] = useState(area?.country ?? 'India')
  const [state, setState] = useState(area?.state ?? '')
  const [city, setCity] = useState(area?.city ?? '')
  const [zone, setZone] = useState(area?.zone ?? '')
  const [rideEnabled, setRideEnabled] = useState(area?.rideEnabled ?? true)
  const [transportEnabled, setTransportEnabled] = useState(area?.transportEnabled ?? true)
  const [status, setStatus] = useState(area?.status ?? 'active')
  const [centerLat, setCenterLat] = useState(area?.geofence?.centerLat)
  const [centerLng, setCenterLng] = useState(area?.geofence?.centerLng)
  const [radiusKm, setRadiusKm] = useState(area?.geofence?.radiusKm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload: Partial<ServiceArea> = {
      name,
      country,
      state,
      city,
      zone,
      rideEnabled,
      transportEnabled,
      status,
      geofence: {
        centerLat: centerLat === undefined || Number.isNaN(centerLat) ? undefined : Number(centerLat),
        centerLng: centerLng === undefined || Number.isNaN(centerLng) ? undefined : Number(centerLng),
        radiusKm: radiusKm === undefined || Number.isNaN(radiusKm) ? undefined : Number(radiusKm),
      },
    }
    try {
      const saved = area ? await updateServiceArea(area.id, payload) : await createServiceArea(payload)
      onSaved(saved)
    } catch (err) {
      setError(errMessage(err, 'Could not save service area'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`${area ? 'Edit' : 'Add'} service area`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <Field label="Name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country">
            <input required value={country} onChange={(e) => setCountry(e.target.value)} className="input" />
          </Field>
          <Field label="State">
            <input required value={state} onChange={(e) => setState(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input required value={city} onChange={(e) => setCity(e.target.value)} className="input" />
          </Field>
          <Field label="Zone (optional)">
            <input value={zone} onChange={(e) => setZone(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2.5">
            <span className="text-sm text-navy-700">Ride enabled</span>
            <Toggle checked={rideEnabled} onChange={setRideEnabled} label="Ride enabled" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2.5">
            <span className="text-sm text-navy-700">Transport enabled</span>
            <Toggle checked={transportEnabled} onChange={setTransportEnabled} label="Transport enabled" />
          </div>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Center lat (optional)">
            <input
              type="number"
              step="any"
              value={centerLat ?? ''}
              onChange={(e) => setCenterLat(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Center lng (optional)">
            <input
              type="number"
              step="any"
              value={centerLng ?? ''}
              onChange={(e) => setCenterLng(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Radius km (optional)">
            <input
              type="number"
              step="any"
              value={radiusKm ?? ''}
              onChange={(e) => setRadiusKm(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {area ? 'Save changes' : 'Create service area'}
        </button>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-navy-600">{label}</span>
      {children}
    </label>
  )
}
