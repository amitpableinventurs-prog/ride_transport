import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, ImageOff } from 'lucide-react'
import { fetchBanners, createBanner, updateBanner } from '@/api/banners'
import type { Banner, ServiceMode } from '@/types/marketing'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function toDateInputValue(value?: string) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function errMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

export function BannersPage() {
  const [banners, setBanners] = useState<Banner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)

  async function load() {
    setBanners(await fetchBanners())
  }

  useEffect(() => {
    load().catch(() => setError('Could not load banners.'))
  }, [])

  if (!banners) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Banners</h1>
          <p className="text-sm text-navy-400">Promotional banners shown in the customer and driver apps.</p>
        </div>
        <PermissionGate permission="marketing.manage">
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Banner
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Preview</th>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Service mode</th>
              <th className="px-5 py-3 font-medium">Date range</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner) => (
              <tr key={banner.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3">
                  <BannerThumb src={banner.imageUrl} />
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-navy-800">{banner.title}</p>
                  {banner.description && <p className="max-w-xs truncate text-xs text-navy-300">{banner.description}</p>}
                </td>
                <td className="px-5 py-3 text-navy-600 capitalize">{banner.serviceMode}</td>
                <td className="px-5 py-3 text-navy-500">
                  {dateFmt.format(new Date(banner.startDate))} — {dateFmt.format(new Date(banner.endDate))}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={banner.status === 'active' ? 'success' : 'neutral'}>{banner.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <PermissionGate permission="marketing.manage">
                    <button
                      onClick={() => {
                        setEditing(banner)
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
            {banners.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-navy-300">
                  No banners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <BannerFormModal
          banner={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setBanners((prev) => {
              const list = prev ?? []
              const exists = list.some((b) => b.id === saved.id)
              return exists ? list.map((b) => (b.id === saved.id ? saved : b)) : [saved, ...list]
            })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function BannerThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-10 w-16 items-center justify-center rounded-md border border-navy-100 bg-navy-50 text-navy-300">
        <ImageOff size={16} />
      </div>
    )
  }
  return <img src={src} onError={() => setFailed(true)} alt="" className="h-10 w-16 rounded-md border border-navy-100 object-cover" />
}

function BannerFormModal({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner | null
  onClose: () => void
  onSaved: (banner: Banner) => void
}) {
  const [title, setTitle] = useState(banner?.title ?? '')
  const [description, setDescription] = useState(banner?.description ?? '')
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? '')
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? '')
  const [targetLink, setTargetLink] = useState(banner?.targetLink ?? '')
  const [serviceMode, setServiceMode] = useState<ServiceMode>(banner?.serviceMode ?? 'both')
  const [startDate, setStartDate] = useState(toDateInputValue(banner?.startDate))
  const [endDate, setEndDate] = useState(toDateInputValue(banner?.endDate))
  const [status, setStatus] = useState(banner?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload: Partial<Banner> = {
      title,
      description,
      imageUrl,
      ctaLabel,
      targetLink,
      serviceMode,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      status,
    }
    try {
      const saved = banner ? await updateBanner(banner.id, payload) : await createBanner(payload)
      onSaved(saved)
    } catch (err) {
      setError(errMessage(err, 'Could not save banner'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`${banner ? 'Edit' : 'Add'} banner`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <Field label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <Field label="Description (optional)">
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </Field>
        <Field label="Image URL">
          <input required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CTA label (optional)">
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="input" />
          </Field>
          <Field label="Target link (optional)">
            <input value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Service mode">
          <select value={serviceMode} onChange={(e) => setServiceMode(e.target.value as ServiceMode)} className="input">
            <option value="both">Both</option>
            <option value="ride">Ride</option>
            <option value="transport">Transport</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </Field>
          <Field label="End date">
            <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {banner ? 'Save changes' : 'Create banner'}
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
