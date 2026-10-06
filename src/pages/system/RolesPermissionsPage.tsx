import { useEffect, useState } from 'react'
import { Save, Check } from 'lucide-react'
import { fetchRoles, updateRolePermissions } from '@/api/roles'
import { PERMISSION_GROUPS, type PermissionKey, type Role, type RoleKey } from '@/types/rbac'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import clsx from 'clsx'

export function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [selectedKey, setSelectedKey] = useState<RoleKey | null>(null)
  const [draft, setDraft] = useState<Set<PermissionKey>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRoles()
      .then((data) => {
        setRoles(data)
        setSelectedKey(data[0]?.key ?? null)
        setDraft(new Set(data[0]?.permissions ?? []))
      })
      .catch(() => setError('Could not load roles.'))
  }, [])

  function selectRole(role: Role) {
    setSelectedKey(role.key)
    setDraft(new Set(role.permissions))
    setSaved(false)
  }

  function toggle(permission: PermissionKey) {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!selectedKey) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateRolePermissions(selectedKey, Array.from(draft))
      setRoles((prev) => prev!.map((r) => (r.key === selectedKey ? updated : r)))
      setSaved(true)
    } catch {
      setError('Could not save permissions.')
    } finally {
      setSaving(false)
    }
  }

  if (!roles || !selectedKey) return <LoadingScreen />
  const selectedRole = roles.find((r) => r.key === selectedKey)!
  const isDirty = JSON.stringify(Array.from(draft).sort()) !== JSON.stringify([...selectedRole.permissions].sort())

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Roles &amp; Permissions</h1>
        <p className="text-sm text-navy-400">Role-based access control across the admin panel.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1.5">
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => selectRole(role)}
              className={clsx(
                'w-full rounded-xl border p-3 text-left transition-colors',
                role.key === selectedKey ? 'border-navy-400 bg-navy-50' : 'border-navy-100 bg-white hover:border-navy-200',
              )}
            >
              <p className="text-sm font-semibold text-navy-800">{role.name}</p>
              <p className="mt-0.5 text-xs text-navy-400">{role.permissions.length} permissions</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy-800">{selectedRole.name}</h2>
              <p className="text-xs text-navy-400">{selectedRole.description}</p>
            </div>
            <PermissionGate permission="roles.manage">
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-50"
              >
                {saved && !isDirty ? <Check size={16} /> : <Save size={16} />}
                {saving ? 'Saving…' : saved && !isDirty ? 'Saved' : 'Save changes'}
              </button>
            </PermissionGate>
          </div>

          <div className="space-y-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">{group.label}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2.5 rounded-lg border border-navy-50 px-3 py-2 text-sm text-navy-700 hover:bg-navy-50"
                    >
                      <PermissionGate
                        permission="roles.manage"
                        fallback={
                          <input type="checkbox" checked={draft.has(perm.key)} disabled className="h-4 w-4 rounded border-navy-200" />
                        }
                      >
                        <input
                          type="checkbox"
                          checked={draft.has(perm.key)}
                          onChange={() => toggle(perm.key)}
                          className="h-4 w-4 rounded border-navy-200 text-brand-orange focus:ring-brand-orange"
                        />
                      </PermissionGate>
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
