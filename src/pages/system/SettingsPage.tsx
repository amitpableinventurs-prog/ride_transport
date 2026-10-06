import { useEffect, useState, type FormEvent } from 'react'
import { Save, Check } from 'lucide-react'
import { fetchSettings, updateSettings } from '@/api/settings'
import type { PlatformSettings } from '@/types/settings'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import { Toggle } from '@/components/common/Toggle'
import { useAuthStore } from '@/store/authStore'

export function SettingsPage() {
  const canManage = useAuthStore((s) => s.hasPermission('settings.manage'))
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setError('Could not load settings.'))
  }, [])

  if (!settings) return error ? <p className="text-sm text-brand-red">{error}</p> : <LoadingScreen />

  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateSettings(settings)
      setSettings(updated)
      setSaved(true)
    } catch {
      setError('Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Settings</h1>
        <p className="text-sm text-navy-400">Platform-wide configuration. Changes are audit logged.</p>
      </div>

      <fieldset disabled={!canManage} className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-navy-800">General</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Platform name">
                <input value={settings.platformName} onChange={(e) => update('platformName', e.target.value)} className="input" />
              </Field>
              <Field label="Support email">
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => update('supportEmail', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Support phone">
                <input value={settings.supportPhone} onChange={(e) => update('supportPhone', e.target.value)} className="input" />
              </Field>
              <Field label="Default currency">
                <input value={settings.defaultCurrency} onChange={(e) => update('defaultCurrency', e.target.value)} className="input" />
              </Field>
              <Field label="Default country">
                <input value={settings.defaultCountry} onChange={(e) => update('defaultCountry', e.target.value)} className="input" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-navy-800">Service availability</h2>
            <div className="space-y-3">
              <ToggleRow label="Ride service enabled" checked={settings.rideServiceEnabled} onChange={(v) => update('rideServiceEnabled', v)} />
              <ToggleRow
                label="Transport service enabled"
                checked={settings.transportServiceEnabled}
                onChange={(v) => update('transportServiceEnabled', v)}
              />
              <ToggleRow label="Maintenance mode" checked={settings.maintenanceMode} onChange={(v) => update('maintenanceMode', v)} />
            </div>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-navy-800">Security</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="OTP expiry (minutes)">
                <input
                  type="number"
                  min={1}
                  value={settings.otpExpiryMinutes}
                  onChange={(e) => update('otpExpiryMinutes', Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="Access token TTL (minutes)">
                <input
                  type="number"
                  min={1}
                  value={settings.accessTokenTtlMinutes}
                  onChange={(e) => update('accessTokenTtlMinutes', Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="Refresh token TTL (days)">
                <input
                  type="number"
                  min={1}
                  value={settings.refreshTokenTtlDays}
                  onChange={(e) => update('refreshTokenTtlDays', Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
            <div className="mt-4 border-t border-navy-50 pt-4">
              <ToggleRow
                label="Require OTP for admin sign-in (sent by SMS to the admin's phone)"
                checked={settings.adminLoginOtpEnabled}
                onChange={(v) => update('adminLoginOtpEnabled', v)}
              />
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

          <PermissionGate permission="settings.manage">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
            </button>
          </PermissionGate>
        </form>
      </fieldset>
    </div>
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

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-navy-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
