import { useEffect, useState, type FormEvent } from 'react'
import { Plus, ShieldOff, ShieldCheck } from 'lucide-react'
import { fetchAdminUsers, createAdminUser, updateAdminUser } from '@/api/adminUsers'
import { fetchRoles } from '@/api/roles'
import type { AdminUser, Role, RoleKey } from '@/types/rbac'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import { useAuthStore } from '@/store/authStore'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [admins, setAdmins] = useState<AdminUser[] | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const [adminsData, rolesData] = await Promise.all([fetchAdminUsers(), fetchRoles()])
    setAdmins(adminsData)
    setRoles(rolesData)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load admin users.'))
  }, [])

  function roleName(key: RoleKey) {
    return roles.find((r) => r.key === key)?.name ?? key
  }

  async function toggleStatus(admin: AdminUser) {
    setBusyId(admin.id)
    try {
      const updated = await updateAdminUser(admin.id, { status: admin.status === 'active' ? 'suspended' : 'active' })
      setAdmins((prev) => prev!.map((a) => (a.id === admin.id ? updated : a)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function changeRole(admin: AdminUser, role: RoleKey) {
    setBusyId(admin.id)
    try {
      const updated = await updateAdminUser(admin.id, { role })
      setAdmins((prev) => prev!.map((a) => (a.id === admin.id ? updated : a)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!admins) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-800">Admin Users</h1>
          <p className="text-sm text-navy-400">Manage admin accounts and their assigned roles.</p>
        </div>
        <PermissionGate permission="admins.manage">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
          >
            <Plus size={16} /> Add Admin
          </button>
        </PermissionGate>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Admin</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last login</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: admin.avatarColor }}
                    >
                      {admin.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-navy-800">{admin.name}</p>
                      <p className="text-xs text-navy-300">{admin.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <PermissionGate permission="admins.manage" fallback={<span className="text-navy-600">{roleName(admin.role)}</span>}>
                    <select
                      value={admin.role}
                      disabled={busyId === admin.id || admin.id === currentUser?.id}
                      onChange={(e) => changeRole(admin, e.target.value as RoleKey)}
                      className="rounded-lg border border-navy-100 bg-white px-2 py-1 text-sm text-navy-700 disabled:opacity-60"
                    >
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </PermissionGate>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={admin.status === 'active' ? 'success' : 'danger'}>{admin.status}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-500">{admin.lastLoginAt ? dateFmt.format(new Date(admin.lastLoginAt)) : 'Never'}</td>
                <td className="px-5 py-3 text-right">
                  <PermissionGate permission="admins.manage">
                    <button
                      onClick={() => toggleStatus(admin)}
                      disabled={busyId === admin.id || admin.id === currentUser?.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                      title={admin.id === currentUser?.id ? 'You cannot change your own status' : undefined}
                    >
                      {admin.status === 'active' ? (
                        <>
                          <ShieldOff size={14} /> Suspend
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> Activate
                        </>
                      )}
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateAdminModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={(admin) => {
            setAdmins((prev) => [...(prev ?? []), admin])
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

function CreateAdminModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[]
  onClose: () => void
  onCreated: (admin: AdminUser) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<RoleKey>(roles[0]?.key ?? 'operations_admin')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const admin = await createAdminUser({ name, email, phone, role })
      onCreated(admin)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not create admin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Add admin user" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Phone</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleKey)}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
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
          Create admin
        </button>
      </form>
    </Modal>
  )
}
