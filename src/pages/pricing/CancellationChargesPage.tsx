import { useEffect, useState } from 'react'
import { fetchPricingRules, updatePricingRule } from '@/api/pricing'
import type { PricingRule } from '@/types/finance'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function CancellationChargesPage() {
  const [rules, setRules] = useState<PricingRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  async function load() {
    const data = await fetchPricingRules()
    setRules(data)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load pricing rules.'))
  }, [])

  async function saveFee(rule: PricingRule) {
    const raw = drafts[rule.id]
    if (raw === undefined) return
    const value = Number(raw)
    if (Number.isNaN(value) || value < 0) {
      setError('Cancellation fee must be a non-negative number.')
      return
    }
    setBusyId(rule.id)
    setError(null)
    try {
      const updated = await updatePricingRule(rule.id, { cancellationFee: value })
      setRules((prev) => prev!.map((r) => (r.id === rule.id ? updated : r)))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[rule.id]
        return next
      })
    } catch {
      setError('Could not update cancellation fee.')
    } finally {
      setBusyId(null)
    }
  }

  if (!rules) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Cancellation Charges</h1>
        <p className="text-sm text-navy-400">Per-category cancellation fees charged when a customer or driver cancels a booking.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Mode</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Cancellation fee</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const draft = drafts[rule.id] ?? String(rule.cancellationFee)
              const dirty = drafts[rule.id] !== undefined && drafts[rule.id] !== String(rule.cancellationFee)
              return (
                <tr key={rule.id} className="border-b border-navy-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-800">{rule.categoryKey}</td>
                  <td className="px-5 py-3 text-navy-600 capitalize">{rule.mode}</td>
                  <td className="px-5 py-3">
                    <Badge tone={rule.status === 'active' ? 'success' : 'neutral'}>{rule.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <PermissionGate permission="pricing.manage" fallback={<span className="text-navy-600">{moneyFmt.format(rule.cancellationFee)}</span>}>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [rule.id]: e.target.value }))}
                        className="w-28 rounded-lg border border-navy-100 px-2 py-1 text-sm outline-none focus:border-navy-400"
                      />
                    </PermissionGate>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <PermissionGate permission="pricing.manage">
                      <button
                        onClick={() => saveFee(rule)}
                        disabled={!dirty || busyId === rule.id}
                        className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-50"
                      >
                        Save
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              )
            })}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-navy-300">
                  No pricing rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
