import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { fetchCoupons, createCoupon, updateCoupon } from '@/api/coupons'
import type { Coupon, DiscountType, ServiceMode } from '@/types/marketing'
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

interface CouponOfferManagerProps {
  variant: 'coupon' | 'offer'
}

export function CouponOfferManager({ variant }: CouponOfferManagerProps) {
  const isOffer = variant === 'offer'
  const [items, setItems] = useState<Coupon[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  async function load() {
    const data = await fetchCoupons({ autoApply: isOffer })
    setItems(data)
  }

  useEffect(() => {
    setItems(null)
    load().catch(() => setError(`Could not load ${isOffer ? 'offers' : 'coupons'}.`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffer])

  function discountLabel(c: Coupon) {
    return c.discountType === 'percentage' ? `${c.amount}%` : `Rs ${c.amount}`
  }

  if (!items) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">{isOffer ? 'Offers' : 'Coupons'}</h1>
          <p className="text-sm text-navy-400">
            {isOffer ? 'Auto-applied discounts with no code required.' : 'Code-based discounts riders and customers can redeem.'}
          </p>
        </div>
        <PermissionGate permission="marketing.manage">
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> {isOffer ? 'Add Offer' : 'Add Coupon'}
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              {!isOffer && <th className="px-5 py-3 font-medium">Code</th>}
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Valid</th>
              <th className="px-5 py-3 font-medium">Used / Limit</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-navy-50 last:border-0">
                {!isOffer && (
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-navy-700">{item.code ?? '—'}</td>
                )}
                <td className="px-5 py-3">
                  <p className="font-medium text-navy-800">{item.title}</p>
                  <p className="text-xs text-navy-300">{item.applicableMode}</p>
                </td>
                <td className="px-5 py-3 text-navy-600">{discountLabel(item)}</td>
                <td className="px-5 py-3 text-navy-500">
                  {dateFmt.format(new Date(item.validFrom))} — {dateFmt.format(new Date(item.validTo))}
                </td>
                <td className="px-5 py-3 text-navy-500">
                  {item.usedCount} / {item.usageLimitTotal ?? '∞'}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <PermissionGate permission="marketing.manage">
                    <button
                      onClick={() => {
                        setEditing(item)
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
            {items.length === 0 && (
              <tr>
                <td colSpan={isOffer ? 6 : 7} className="px-5 py-8 text-center text-sm text-navy-300">
                  No {isOffer ? 'offers' : 'coupons'} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CouponFormModal
          isOffer={isOffer}
          coupon={editing}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setItems((prev) => {
              const list = prev ?? []
              const exists = list.some((c) => c.id === saved.id)
              return exists ? list.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...list]
            })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function CouponFormModal({
  isOffer,
  coupon,
  onClose,
  onSaved,
}: {
  isOffer: boolean
  coupon: Coupon | null
  onClose: () => void
  onSaved: (coupon: Coupon) => void
}) {
  const [code, setCode] = useState(coupon?.code ?? '')
  const [title, setTitle] = useState(coupon?.title ?? '')
  const [discountType, setDiscountType] = useState<DiscountType>(coupon?.discountType ?? 'flat')
  const [amount, setAmount] = useState(coupon?.amount ?? 0)
  const [minBookingAmount, setMinBookingAmount] = useState(coupon?.minBookingAmount ?? 0)
  const [maxDiscount, setMaxDiscount] = useState(coupon?.maxDiscount ?? undefined)
  const [validFrom, setValidFrom] = useState(toDateInputValue(coupon?.validFrom))
  const [validTo, setValidTo] = useState(toDateInputValue(coupon?.validTo))
  const [usageLimitTotal, setUsageLimitTotal] = useState(coupon?.usageLimitTotal ?? undefined)
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(coupon?.usageLimitPerUser ?? undefined)
  const [applicableMode, setApplicableMode] = useState<ServiceMode>(coupon?.applicableMode ?? 'both')
  const [applicableCategories, setApplicableCategories] = useState((coupon?.applicableCategories ?? []).join(', '))
  const [status, setStatus] = useState(coupon?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload: Partial<Coupon> = {
      title,
      autoApply: isOffer,
      discountType,
      amount: Number(amount),
      minBookingAmount: Number(minBookingAmount) || 0,
      maxDiscount: maxDiscount === undefined || maxDiscount === null ? undefined : Number(maxDiscount),
      validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
      validTo: validTo ? new Date(validTo).toISOString() : undefined,
      usageLimitTotal: usageLimitTotal === undefined || usageLimitTotal === null ? undefined : Number(usageLimitTotal),
      usageLimitPerUser: usageLimitPerUser === undefined || usageLimitPerUser === null ? undefined : Number(usageLimitPerUser),
      applicableMode,
      applicableCategories: applicableCategories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      status,
    }
    if (!isOffer) payload.code = code.trim() ? code.trim() : undefined

    try {
      const saved = coupon ? await updateCoupon(coupon.id, payload) : await createCoupon(payload)
      onSaved(saved)
    } catch (err) {
      setError(errMessage(err, `Could not save ${isOffer ? 'offer' : 'coupon'}`))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`${coupon ? 'Edit' : 'Add'} ${isOffer ? 'offer' : 'coupon'}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {!isOffer && (
          <Field label="Code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME50"
              className="input"
            />
          </Field>
        )}
        <Field label="Title">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount type">
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className="input">
              <option value="flat">Flat</option>
              <option value="percentage">Percentage</option>
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" required min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min booking amount">
            <input
              type="number"
              min={0}
              value={minBookingAmount}
              onChange={(e) => setMinBookingAmount(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Max discount (optional)">
            <input
              type="number"
              min={0}
              value={maxDiscount ?? ''}
              onChange={(e) => setMaxDiscount(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid from">
            <input type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input" />
          </Field>
          <Field label="Valid to">
            <input type="date" required value={validTo} onChange={(e) => setValidTo(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usage limit (total, optional)">
            <input
              type="number"
              min={0}
              value={usageLimitTotal ?? ''}
              onChange={(e) => setUsageLimitTotal(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Usage limit (per user, optional)">
            <input
              type="number"
              min={0}
              value={usageLimitPerUser ?? ''}
              onChange={(e) => setUsageLimitPerUser(e.target.value === '' ? undefined : Number(e.target.value))}
              className="input"
            />
          </Field>
        </div>
        <Field label="Applicable mode">
          <select value={applicableMode} onChange={(e) => setApplicableMode(e.target.value as ServiceMode)} className="input">
            <option value="both">Both</option>
            <option value="ride">Ride</option>
            <option value="transport">Transport</option>
          </select>
        </Field>
        <Field label="Applicable categories (comma separated, optional)">
          <input value={applicableCategories} onChange={(e) => setApplicableCategories(e.target.value)} className="input" />
        </Field>
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
          {coupon ? 'Save changes' : `Create ${isOffer ? 'offer' : 'coupon'}`}
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

export function CouponsPage() {
  return <CouponOfferManager variant="coupon" />
}
