import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import { fetchPricingRules, createPricingRule, updatePricingRule, deactivatePricingRule } from '@/api/pricing'
import type { PricingRule } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

interface TransportFormValues {
  categoryKey: string
  baseFare: string
  perKm: string
  perMinute: string
  minimumFare: string
  waitingChargePerMin: string
  platformFeeFlat: string
  platformFeePercent: string
  loadingUnloadingCharge: string
  additionalStopCharge: string
  taxPercent: string
  status: 'active' | 'inactive'
}

const emptyForm: TransportFormValues = {
  categoryKey: '',
  baseFare: '',
  perKm: '',
  perMinute: '0',
  minimumFare: '',
  waitingChargePerMin: '0',
  platformFeeFlat: '0',
  platformFeePercent: '0',
  loadingUnloadingCharge: '0',
  additionalStopCharge: '0',
  taxPercent: '0',
  status: 'active',
}

function toFormValues(rule: PricingRule): TransportFormValues {
  return {
    categoryKey: rule.categoryKey,
    baseFare: String(rule.baseFare),
    perKm: String(rule.perKm),
    perMinute: String(rule.perMinute),
    minimumFare: String(rule.minimumFare),
    waitingChargePerMin: String(rule.waitingChargePerMin),
    platformFeeFlat: String(rule.platformFeeFlat),
    platformFeePercent: String(rule.platformFeePercent),
    loadingUnloadingCharge: String(rule.loadingUnloadingCharge),
    additionalStopCharge: String(rule.additionalStopCharge),
    taxPercent: String(rule.taxPercent),
    status: rule.status,
  }
}

export function TransportPricingPage() {
  const [rules, setRules] = useState<PricingRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalRule, setModalRule] = useState<PricingRule | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await fetchPricingRules({ mode: 'transport' })
    setRules(data)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load transport pricing rules.'))
  }, [])

  async function toggleStatus(rule: PricingRule) {
    setBusyId(rule.id)
    try {
      const updated =
        rule.status === 'active' ? await deactivatePricingRule(rule.id) : await updatePricingRule(rule.id, { status: 'active' })
      setRules((prev) => prev!.map((r) => (r.id === rule.id ? updated : r)))
    } catch {
      setError('Could not update rule status.')
    } finally {
      setBusyId(null)
    }
  }

  if (!rules) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Transport Pricing</h1>
          <p className="text-sm text-navy-400">Fare rules, loading/unloading and additional-stop charges for goods transport.</p>
        </div>
        <PermissionGate permission="pricing.manage">
          <button
            onClick={() => setModalRule('new')}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Rule
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Base fare</th>
              <th className="px-5 py-3 font-medium">Per km</th>
              <th className="px-5 py-3 font-medium">Minimum fare</th>
              <th className="px-5 py-3 font-medium">Loading/unloading</th>
              <th className="px-5 py-3 font-medium">Additional stop</th>
              <th className="px-5 py-3 font-medium">Tax %</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800">{rule.categoryKey}</td>
                <td className="px-5 py-3 text-navy-600">{moneyFmt.format(rule.baseFare)}</td>
                <td className="px-5 py-3 text-navy-600">{moneyFmt.format(rule.perKm)}</td>
                <td className="px-5 py-3 text-navy-600">{moneyFmt.format(rule.minimumFare)}</td>
                <td className="px-5 py-3 text-navy-600">{moneyFmt.format(rule.loadingUnloadingCharge)}</td>
                <td className="px-5 py-3 text-navy-600">{moneyFmt.format(rule.additionalStopCharge)}</td>
                <td className="px-5 py-3 text-navy-600">{rule.taxPercent}%</td>
                <td className="px-5 py-3">
                  <Badge tone={rule.status === 'active' ? 'success' : 'neutral'}>{rule.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PermissionGate permission="pricing.manage">
                      <button
                        onClick={() => setModalRule(rule)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(rule)}
                        disabled={busyId === rule.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                      >
                        <Power size={14} /> {rule.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </PermissionGate>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-navy-300">
                  No transport pricing rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalRule && (
        <TransportRuleModal
          rule={modalRule === 'new' ? null : modalRule}
          onClose={() => setModalRule(null)}
          onSaved={(rule) => {
            setRules((prev) => {
              if (!prev) return [rule]
              const exists = prev.some((r) => r.id === rule.id)
              return exists ? prev.map((r) => (r.id === rule.id ? rule : r)) : [...prev, rule]
            })
            setModalRule(null)
          }}
        />
      )}
    </div>
  )
}

function TransportRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: PricingRule | null
  onClose: () => void
  onSaved: (rule: PricingRule) => void
}) {
  const [values, setValues] = useState<TransportFormValues>(rule ? toFormValues(rule) : emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof TransportFormValues>(key: K, value: TransportFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        mode: 'transport' as const,
        categoryKey: values.categoryKey.trim(),
        baseFare: Number(values.baseFare),
        perKm: Number(values.perKm),
        perMinute: Number(values.perMinute || 0),
        minimumFare: Number(values.minimumFare),
        waitingChargePerMin: Number(values.waitingChargePerMin || 0),
        platformFeeFlat: Number(values.platformFeeFlat || 0),
        platformFeePercent: Number(values.platformFeePercent || 0),
        loadingUnloadingCharge: Number(values.loadingUnloadingCharge || 0),
        additionalStopCharge: Number(values.additionalStopCharge || 0),
        taxPercent: Number(values.taxPercent || 0),
        status: values.status,
      }
      const saved = rule ? await updatePricingRule(rule.id, payload) : await createPricingRule(payload)
      onSaved(saved)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not save rule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={rule ? 'Edit transport pricing rule' : 'Add transport pricing rule'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Category key</label>
          <input
            required
            value={values.categoryKey}
            onChange={(e) => set('categoryKey', e.target.value)}
            placeholder="e.g. mini-truck, tempo, packers-movers"
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Base fare" value={values.baseFare} onChange={(v) => set('baseFare', v)} required />
          <NumberField label="Per km" value={values.perKm} onChange={(v) => set('perKm', v)} required />
          <NumberField label="Per minute" value={values.perMinute} onChange={(v) => set('perMinute', v)} />
          <NumberField label="Minimum fare" value={values.minimumFare} onChange={(v) => set('minimumFare', v)} required />
          <NumberField label="Waiting charge / min" value={values.waitingChargePerMin} onChange={(v) => set('waitingChargePerMin', v)} />
          <NumberField label="Platform fee (flat)" value={values.platformFeeFlat} onChange={(v) => set('platformFeeFlat', v)} />
          <NumberField label="Platform fee (%)" value={values.platformFeePercent} onChange={(v) => set('platformFeePercent', v)} />
          <NumberField label="Tax (%)" value={values.taxPercent} onChange={(v) => set('taxPercent', v)} />
          <NumberField
            label="Loading/unloading charge"
            value={values.loadingUnloadingCharge}
            onChange={(v) => set('loadingUnloadingCharge', v)}
          />
          <NumberField label="Additional stop charge" value={values.additionalStopCharge} onChange={(v) => set('additionalStopCharge', v)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Status</label>
          <select
            value={values.status}
            onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {rule ? 'Save changes' : 'Create rule'}
        </button>
      </form>
    </Modal>
  )
}

function NumberField({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-navy-600">{label}</label>
      <input
        type="number"
        step="0.01"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
      />
    </div>
  )
}
