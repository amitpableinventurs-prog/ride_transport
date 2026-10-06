import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { Bike, Bus, Car, CarFront, CarTaxiFront, Container, Package, Pencil, Plus, Tags, Trash2, Truck } from 'lucide-react'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '@/api/categories'
import { fetchVehicleTypes } from '@/api/vehicleTypes'
import type { ServiceCategory, ServiceMode } from '@/types/booking'
import type { VehicleType } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

// Category icons are stored as lucide icon names so the Flutter apps can map them too.
const ICONS: Record<string, LucideIcon> = {
  'car-taxi-front': CarTaxiFront,
  car: Car,
  'car-front': CarFront,
  bike: Bike,
  bus: Bus,
  package: Package,
  truck: Truck,
  container: Container,
}

const MODE_SUBTITLE: Record<ServiceMode, string> = {
  ride: 'What customers see under Ride, e.g. Auto, Cab Economy, Cab Premium, Bike.',
  transport: 'What customers see under Transport, e.g. Bike Porter, Small, Medium and Large Vehicles.',
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

function vehicleTypeName(category: ServiceCategory): string | null {
  const vt = category.vehicleType
  return vt && typeof vt === 'object' ? vt.name : null
}

export function CategoriesPage() {
  const [mode, setMode] = useState<ServiceMode>('ride')
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null)
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [modal, setModal] = useState<'create' | ServiceCategory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const [cats, vts] = await Promise.all([fetchCategories(), fetchVehicleTypes({ limit: 100 })])
    setCategories(cats)
    setVehicleTypes(vts.items)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load categories.'))
  }, [])

  async function toggleStatus(category: ServiceCategory) {
    setBusyId(category.id)
    setError(null)
    try {
      await updateCategory(category.id, { status: category.status === 'active' ? 'inactive' : 'active' })
      await load()
    } catch (err) {
      setError(apiError(err, 'Action failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(category: ServiceCategory) {
    if (!window.confirm(`Delete the "${category.name}" category? Customers will no longer see it.`)) return
    setBusyId(category.id)
    setError(null)
    try {
      await deleteCategory(category.id)
      setCategories((prev) => prev!.filter((c) => c.id !== category.id))
    } catch (err) {
      setError(apiError(err, 'Could not delete category'))
    } finally {
      setBusyId(null)
    }
  }

  if (!categories) return error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p> : <LoadingScreen />

  const visible = categories.filter((c) => c.mode === mode)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Service Categories</h1>
          <p className="text-sm text-navy-400">{MODE_SUBTITLE[mode]}</p>
        </div>
        <PermissionGate permission="bookings.manage">
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add {mode === 'ride' ? 'Ride' : 'Transport'} Category
          </button>
        </PermissionGate>
      </div>

      <div className="inline-flex rounded-xl bg-navy-50 p-1" role="tablist" aria-label="Service mode">
        {(['ride', 'transport'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={clsx(
              'rounded-lg px-5 py-1.5 text-sm font-medium transition-colors',
              mode === m ? 'bg-navy-800 text-white shadow-sm' : 'text-navy-500 hover:text-navy-700',
            )}
          >
            {m === 'ride' ? 'Ride' : 'Transport'}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-100 bg-white p-10 text-center text-sm text-navy-300">
          No {mode} categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((category) => {
            const Icon = ICONS[category.icon] ?? Tags
            const vtName = vehicleTypeName(category)
            return (
              <div key={category.id} className="flex flex-col rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={clsx(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      category.status === 'active' ? 'bg-orange-50 text-brand-orange' : 'bg-navy-50 text-navy-300',
                    )}
                  >
                    <Icon size={22} />
                  </div>
                  <Badge tone={category.status === 'active' ? 'success' : 'neutral'}>{category.status}</Badge>
                </div>
                <h3 className="mt-3 font-semibold text-navy-800">{category.name}</h3>
                <p className="mt-0.5 text-sm text-navy-400">{category.description || '—'}</p>

                <dl className="mt-3 space-y-1 text-xs text-navy-500">
                  <div className="flex justify-between gap-2">
                    <dt className="text-navy-300">Key</dt>
                    <dd className="font-mono">{category.key}</dd>
                  </div>
                  {mode === 'ride' ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-navy-300">Seats</dt>
                      <dd>{category.seats ?? '—'}</dd>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-2">
                      <dt className="text-navy-300">Capacity</dt>
                      <dd>{category.capacityLabel || '—'}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-navy-300">Vehicle type</dt>
                    <dd>{vtName ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-navy-300">Display order</dt>
                    <dd>{category.sortOrder}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-navy-50 pt-3">
                  <Link
                    to={mode === 'ride' ? '/pricing/ride' : '/pricing/transport'}
                    className="mr-auto text-xs font-medium text-brand-orange hover:text-brand-orange-dark"
                  >
                    Pricing →
                  </Link>
                  <PermissionGate permission="bookings.manage">
                    <button
                      onClick={() => setModal(category)}
                      disabled={busyId === category.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(category)}
                      disabled={busyId === category.id}
                      className="rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                    >
                      {category.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => remove(category)}
                      disabled={busyId === category.id}
                      aria-label={`Delete ${category.name}`}
                      className="rounded-lg border border-navy-100 p-1.5 text-brand-red hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <CategoryModal
          mode={mode}
          existing={modal === 'create' ? null : modal}
          vehicleTypes={vehicleTypes.filter((vt) => vt.serviceMode === mode)}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function CategoryModal({
  mode,
  existing,
  vehicleTypes,
  onClose,
  onSaved,
}: {
  mode: ServiceMode
  existing: ServiceCategory | null
  vehicleTypes: VehicleType[]
  onClose: () => void
  onSaved: () => void
}) {
  const existingVehicleType = existing?.vehicleType
  const existingVehicleTypeId = existingVehicleType && typeof existingVehicleType === 'object' ? existingVehicleType.id : (existingVehicleType ?? '')

  const [name, setName] = useState(existing?.name ?? '')
  const [key, setKey] = useState(existing?.key ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? (mode === 'ride' ? 'car' : 'truck'))
  const [seats, setSeats] = useState(existing?.seats?.toString() ?? '')
  const [capacityLabel, setCapacityLabel] = useState(existing?.capacityLabel ?? '')
  const [vehicleType, setVehicleType] = useState<string>(existingVehicleTypeId)
  const [sortOrder, setSortOrder] = useState(existing?.sortOrder?.toString() ?? '0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fields = {
      name,
      description,
      icon,
      seats: seats ? Number(seats) : undefined,
      capacityLabel: capacityLabel || undefined,
      sortOrder: Number(sortOrder) || 0,
    }
    try {
      if (existing) {
        await updateCategory(existing.id, { ...fields, vehicleType: vehicleType || null })
      } else {
        await createCategory({ ...fields, mode, key: key.trim(), vehicleType: vehicleType || undefined })
      }
      onSaved()
    } catch (err) {
      setError(apiError(err, 'Could not save category'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400'

  return (
    <Modal title={existing ? `Edit ${existing.name}` : `Add ${mode === 'ride' ? 'Ride' : 'Transport'} category`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cab Economy" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">Key</label>
            <input
              required
              disabled={!!existing}
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="cab_economy"
              title={existing ? 'The key is referenced by pricing and bookings, so it cannot change.' : undefined}
              className={clsx(inputClass, 'font-mono disabled:bg-navy-50 disabled:text-navy-400')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short customer-facing text" className={inputClass} />
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-navy-600">Icon</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ICONS).map(([iconKey, IconCmp]) => (
              <button
                key={iconKey}
                type="button"
                onClick={() => setIcon(iconKey)}
                aria-label={iconKey}
                aria-pressed={icon === iconKey}
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg border',
                  icon === iconKey ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-navy-100 text-navy-400 hover:bg-navy-50',
                )}
              >
                <IconCmp size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mode === 'ride' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">Seats</label>
              <input type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">Capacity / size</label>
              <input value={capacityLabel} onChange={(e) => setCapacityLabel(e.target.value)} placeholder="e.g. 6-14 ft" className={inputClass} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">Display order</label>
            <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Vehicle type</label>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputClass}>
            <option value="">— None —</option>
            {vehicleTypes.map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
                {vt.capacityLabel ? ` (${vt.capacityLabel})` : ''}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {existing ? 'Save changes' : 'Create category'}
        </button>
      </form>
    </Modal>
  )
}
