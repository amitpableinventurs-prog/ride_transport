import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { createVehicle, fetchVehicles, updateVehicle } from '@/api/vehicles'
import { fetchVehicleTypes } from '@/api/vehicleTypes'
import { fetchDrivers } from '@/api/drivers'
import { fetchPartners } from '@/api/partners'
import type { Driver, OwnerType, ServiceMode, TransportPartner, Vehicle, VehicleType } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const STATUS_TONE: Record<Vehicle['status'], 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  blocked: 'danger',
}

const DOC_TONE: Record<Vehicle['documentsStatus'], 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  expired: 'danger',
}

const LIMIT = 20

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await fetchVehicles({ page, limit: LIMIT, q: q || undefined })
    setVehicles(data.items)
    setTotal(data.total)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setError('Could not load vehicles.'))
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  async function toggleStatus(vehicle: Vehicle) {
    setBusyId(vehicle.id)
    try {
      const updated = await updateVehicle(vehicle.id, { status: vehicle.status === 'active' ? 'inactive' : 'active' })
      // The update response returns the raw (unpopulated) vehicle, so keep the
      // richer display-only fields (populated vehicleType, computed ownerLabel)
      // from the existing row rather than overwriting them.
      setVehicles((prev) =>
        prev!.map((v) => (v.id === vehicle.id ? { ...v, ...updated, vehicleType: v.vehicleType, ownerLabel: v.ownerLabel } : v)),
      )
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Vehicles</h1>
          <p className="text-sm text-navy-400">Vehicles registered by drivers and transport partners.</p>
        </div>
        <PermissionGate permission="fleet.manage">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Vehicle
          </button>
        </PermissionGate>
      </div>

      <div className="relative w-72">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
        <input
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
          placeholder="Search registration number or model"
          className="w-full rounded-lg border border-navy-100 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!vehicles ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Registration</th>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Vehicle type</th>
                  <th className="px-5 py-3 font-medium">Service mode</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Documents</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-navy-300">
                      No vehicles found.
                    </td>
                  </tr>
                )}
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-navy-800">{vehicle.registrationNumber}</td>
                    <td className="px-5 py-3 text-navy-600">{vehicle.model}</td>
                    <td className="px-5 py-3 text-navy-600">
                      {typeof vehicle.vehicleType === 'string' ? vehicle.vehicleType : vehicle.vehicleType.name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="info">{vehicle.serviceMode}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{vehicle.ownerLabel ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[vehicle.status]}>{vehicle.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={DOC_TONE[vehicle.documentsStatus]}>{vehicle.documentsStatus}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="fleet.manage">
                        <button
                          onClick={() => toggleStatus(vehicle)}
                          disabled={busyId === vehicle.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                        >
                          {vehicle.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
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

      {showCreate && (
        <CreateVehicleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load().catch(() => setError('Could not refresh vehicles.'))
          }}
        />
      )}
    </div>
  )
}

function CreateVehicleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [partners, setPartners] = useState<TransportPartner[]>([])

  const [registrationNumber, setRegistrationNumber] = useState('')
  const [model, setModel] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [serviceMode, setServiceMode] = useState<ServiceMode>('ride')
  const [categoryKey, setCategoryKey] = useState('')
  const [ownerType, setOwnerType] = useState<OwnerType>('driver')
  const [ownerId, setOwnerId] = useState('')
  const [capacity, setCapacity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchVehicleTypes({ limit: 100 }), fetchDrivers({ limit: 100 }), fetchPartners({ limit: 100 })])
      .then(([vt, d, p]) => {
        setVehicleTypes(vt.items)
        setDrivers(d.items)
        setPartners(p.items)
        if (vt.items[0]) setVehicleType(vt.items[0].id)
      })
      .catch(() => setError('Could not load form options'))
  }, [])

  const ownerOptions = ownerType === 'driver' ? drivers.map((d) => ({ id: d.id, label: d.name })) : partners.map((p) => ({ id: p.id, label: p.companyName }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createVehicle({
        registrationNumber,
        model,
        manufacturer: manufacturer || undefined,
        vehicleType,
        serviceMode,
        categoryKey,
        ownerType,
        ownerId,
        capacity: capacity || undefined,
      })
      onCreated()
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not create vehicle')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add vehicle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Registration number</label>
          <input
            required
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Model</label>
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Manufacturer</label>
          <input
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Vehicle type</label>
          <select
            required
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="" disabled>
              Select vehicle type
            </option>
            {vehicleTypes.map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
              </option>
            ))}
          </select>
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
          <label className="mb-1 block text-xs font-medium text-navy-600">Category key</label>
          <input
            required
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            placeholder="e.g. mini, sedan, truck-1t"
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Owner type</label>
          <select
            value={ownerType}
            onChange={(e) => {
              setOwnerType(e.target.value as OwnerType)
              setOwnerId('')
            }}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="driver">Driver</option>
            <option value="partner">Transport Partner</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Owner</label>
          <select
            required
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="" disabled>
              Select owner
            </option>
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Capacity</label>
          <input
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
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
          Create vehicle
        </button>
      </form>
    </Modal>
  )
}
