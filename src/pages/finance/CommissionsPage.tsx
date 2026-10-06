import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import { fetchCommissionRules, createCommissionRule, updateCommissionRule, deactivateCommissionRule } from '@/api/commissions'
import type { CommissionRule } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

export function CommissionsPage() {
  const [rules, setRules] = useState<CommissionRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalRule, setModalRule] = useState<CommissionRule | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await fetchCommissionRules()
    setRules(data)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load commission rules.'))
  }, [])

  async function toggleStatus(rule: CommissionRule) {
    setBusyId(rule.id)
    try {
      const updated =
        rule.status === 'active' ? await deactivateCommissionRule(rule.id) : await updateCommissionRule(rule.id, { status: 'active' })
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
          <h1 className="text-xl font-semibold text-navy-800">Commissions</h1>
          <p className="text-sm text-navy-400">Platform commission rules deducted from driver and partner earnings.</p>
        </div>
        <PermissionGate permission="finance.manage">
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
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Applies to</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Value</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800 capitalize">{rule.appliesTo}</td>
                <td className="px-5 py-3 text-navy-600">{rule.categoryKey || 'All categories'}</td>
                <td className="px-5 py-3 text-navy-600 capitalize">{rule.type}</td>
                <td className="px-5 py-3 text-navy-800">{rule.type === 'percentage' ? `${rule.value}%` : `₹${rule.value}`}</td>
                <td className="px-5 py-3">
                  <Badge tone={rule.status === 'active' ? 'success' : 'neutral'}>{rule.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <PermissionGate permission="finance.manage">
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
                <td colSpan={6} className="px-5 py-8 text-center text-navy-300">
                  No commission rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalRule && (
        <CommissionRuleModal
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

function CommissionRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: CommissionRule | null
  onClose: () => void
  onSaved: (rule: CommissionRule) => void
}) {
  const [appliesTo, setAppliesTo] = useState<'driver' | 'partner'>(rule?.appliesTo ?? 'driver')
  const [categoryKey, setCategoryKey] = useState(rule?.categoryKey ?? '')
  const [type, setType] = useState<'percentage' | 'fixed'>(rule?.type ?? 'percentage')
  const [value, setValue] = useState(rule ? String(rule.value) : '')
  const [status, setStatus] = useState<'active' | 'inactive'>(rule?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = { appliesTo, categoryKey: categoryKey.trim() || undefined, type, value: Number(value), status }
      const saved = rule ? await updateCommissionRule(rule.id, payload) : await createCommissionRule(payload)
      onSaved(saved)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not save rule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={rule ? 'Edit commission rule' : 'Add commission rule'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Applies to</label>
          <select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as 'driver' | 'partner')}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            <option value="driver">Driver</option>
            <option value="partner">Transport Partner</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Category key (optional)</label>
          <input
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            placeholder="Leave blank to apply to all categories"
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
              className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">Value</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
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
