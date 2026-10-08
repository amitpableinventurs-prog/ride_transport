import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { createVehicleType, deleteVehicleType, fetchVehicleTypes, updateVehicleType } from '@/api/vehicleTypes'
import type { ServiceMode, VehicleType } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

export function VehicleTypesPage() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[] | null>(null)
  const [modal, setModal] = useState<'create' | VehicleType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await fetchVehicleTypes({ limit: 100 })
    setVehicleTypes(data.items)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load vehicle types.'))
  }, [])

  async function toggleStatus(vt: VehicleType) {
    setBusyId(vt.id)
    try {
      const updated = await updateVehicleType(vt.id, { status: vt.status === 'active' ? 'inactive' : 'active' })
      setVehicleTypes((prev) => prev!.map((v) => (v.id === vt.id ? updated : v)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(vt: VehicleType) {
    if (!window.confirm(`Delete vehicle type "${vt.name}"? This cannot be undone.`)) return
    setBusyId(vt.id)
    setError(null)
    try {
      await deleteVehicleType(vt.id)
      setVehicleTypes((prev) => prev!.filter((v) => v.id !== vt.id))
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not delete vehicle type'
      setError(message)
      window.alert(message)
    } finally {
      setBusyId(null)
    }
  }

  if (!vehicleTypes) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Vehicle Types</h1>
          <p className="text-sm text-navy-400">Categories of vehicles available for ride and transport services.</p>
        </div>
        <PermissionGate permission="fleet.manage">
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Vehicle Type
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Service mode</th>
              <th className="px-5 py-3 font-medium">Capacity</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicleTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-navy-300">
                  No vehicle types yet.
                </td>
              </tr>
            )}
            {vehicleTypes.map((vt) => (
              <tr key={vt.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800">{vt.name}</td>
                <td className="px-5 py-3">
                  <Badge tone="info">{vt.serviceMode}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-600">{vt.capacityLabel ?? '—'}</td>
                <td className="px-5 py-3">
                  <Badge tone={vt.status === 'active' ? 'success' : 'neutral'}>{vt.status}</Badge>
                </td>
                <td className="px-5 py-3">
                  <PermissionGate permission="fleet.manage">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setModal(vt)}
                        disabled={busyId === vt.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(vt)}
                        disabled={busyId === vt.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                      >
                        {vt.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => remove(vt)}
                        disabled={busyId === vt.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <VehicleTypeModal
          existing={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(vt) => {
            setVehicleTypes((prev) => {
              if (!prev) return [vt]
              const exists = prev.some((p) => p.id === vt.id)
              return exists ? prev.map((p) => (p.id === vt.id ? vt : p)) : [...prev, vt]
            })
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

function VehicleTypeModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: VehicleType | null
  onClose: () => void
  onSaved: (vt: VehicleType) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [serviceMode, setServiceMode] = useState<ServiceMode>(existing?.serviceMode ?? 'ride')
  const [capacityLabel, setCapacityLabel] = useState(existing?.capacityLabel ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const vt = existing
        ? await updateVehicleType(existing.id, { name, serviceMode, capacityLabel })
        : await createVehicleType({ name, serviceMode, capacityLabel: capacityLabel || undefined })
      onSaved(vt)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not save vehicle type')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={existing ? 'Edit vehicle type' : 'Add vehicle type'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Service mode</label>
          <select
            value={serviceMode}
            onChange={(e) => setServiceMode(e.target.value as ServiceMode)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="ride">Ride</option>
            <option value="transport">Transport</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Capacity label</label>
          <input
            value={capacityLabel}
            onChange={(e) => setCapacityLabel(e.target.value)}
            placeholder="e.g. 4 seats, 1 ton"
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {existing ? 'Save changes' : 'Create vehicle type'}
        </button>
      </form>
    </Modal>
  )
}
