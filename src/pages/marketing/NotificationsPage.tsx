import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Send } from 'lucide-react'
import {
  fetchNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  fetchBroadcasts,
  sendBroadcast,
} from '@/api/notifications'
import type { NotificationTemplate, NotificationBroadcast, NotificationChannel, BroadcastAudience, ServiceMode } from '@/types/marketing'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function errMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

type Tab = 'templates' | 'send'

export function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('templates')
  const [templates, setTemplates] = useState<NotificationTemplate[] | null>(null)
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)

  async function loadAll() {
    const [t, b] = await Promise.all([fetchNotificationTemplates(), fetchBroadcasts()])
    setTemplates(t)
    setBroadcasts(b)
  }

  useEffect(() => {
    loadAll().catch(() => setError('Could not load notifications data.'))
  }, [])

  if (!templates || !broadcasts) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Notifications</h1>
        <p className="text-sm text-navy-400">Manage push/SMS/email templates and send broadcasts.</p>
      </div>

      <div className="flex gap-2 border-b border-navy-100">
        {(
          [
            ['templates', 'Templates'],
            ['send', 'Send broadcast'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-brand-orange text-navy-800' : 'border-transparent text-navy-400 hover:text-navy-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <PermissionGate permission="marketing.manage">
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setShowTemplateForm(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark"
              >
                <Plus size={16} /> Add Template
              </button>
            </PermissionGate>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-navy-700">{t.key}</td>
                    <td className="px-5 py-3 text-navy-600 uppercase">{t.channel}</td>
                    <td className="px-5 py-3 text-navy-600">{t.title || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="marketing.manage">
                        <button
                          onClick={() => {
                            setEditingTemplate(t)
                            setShowTemplateForm(true)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-navy-300">
                      No templates yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'send' && (
        <div className="space-y-5">
          <PermissionGate
            permission="marketing.manage"
            fallback={<p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-500">You don't have permission to send broadcasts.</p>}
          >
            <SendBroadcastForm
              templates={templates}
              onSent={(broadcast) => setBroadcasts((prev) => [broadcast, ...(prev ?? [])])}
            />
          </PermissionGate>

          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Audience</th>
                  <th className="px-5 py-3 font-medium">Service mode</th>
                  <th className="px-5 py-3 font-medium">Recipients (est.)</th>
                  <th className="px-5 py-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((b) => (
                  <tr key={b.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-800">{b.title}</p>
                      <p className="max-w-xs truncate text-xs text-navy-300">{b.body}</p>
                    </td>
                    <td className="px-5 py-3 text-navy-600 uppercase">{b.channel}</td>
                    <td className="px-5 py-3 text-navy-600">{b.audience.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-navy-600 capitalize">{b.serviceModeFilter}</td>
                    <td className="px-5 py-3 text-navy-600">{b.recipientCountEstimate.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 text-navy-500">{dateFmt.format(new Date(b.createdAt))}</td>
                  </tr>
                ))}
                {broadcasts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-navy-300">
                      No broadcasts sent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTemplateForm && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => setShowTemplateForm(false)}
          onSaved={(saved) => {
            setTemplates((prev) => {
              const list = prev ?? []
              const exists = list.some((t) => t.id === saved.id)
              return exists ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list]
            })
            setShowTemplateForm(false)
          }}
        />
      )}
    </div>
  )
}

function SendBroadcastForm({ templates, onSent }: { templates: NotificationTemplate[]; onSent: (b: NotificationBroadcast) => void }) {
  const [templateId, setTemplateId] = useState('')
  const [channel, setChannel] = useState<NotificationChannel>('push')
  const [audience, setAudience] = useState<BroadcastAudience>('all_customers')
  const [serviceModeFilter, setServiceModeFilter] = useState<ServiceMode>('both')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function applyTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((tpl) => tpl.id === id)
    if (t) {
      setChannel(t.channel)
      setTitle(t.title ?? '')
      setBody(t.body)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const broadcast = await sendBroadcast({
        templateId: templateId || undefined,
        channel,
        audience,
        serviceModeFilter,
        title,
        body,
      })
      onSent(broadcast)
      setSuccess(true)
    } catch (err) {
      setError(errMessage(err, 'Could not send broadcast'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-navy-800">Send a broadcast</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Template (optional)</span>
          <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="input">
            <option value="">Freeform (no template)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Channel</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} className="input">
            <option value="push">Push</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Audience</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)} className="input">
            <option value="all_customers">All customers</option>
            <option value="all_drivers">All drivers</option>
            <option value="all_partners">All partners</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Service mode filter</span>
          <select value={serviceModeFilter} onChange={(e) => setServiceModeFilter(e.target.value as ServiceMode)} className="input">
            <option value="both">Both</option>
            <option value="ride">Ride</option>
            <option value="transport">Transport</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-navy-600">Title</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-navy-600">Body</span>
        <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
        <span className="mt-1 block text-xs text-navy-300">Supports placeholders like {'{{name}}'}.</span>
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-brand-green-dark">Broadcast logged and simulated as sent.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
      >
        <Send size={16} /> {submitting ? 'Sending…' : 'Send broadcast'}
      </button>
    </form>
  )
}

function TemplateFormModal({
  template,
  onClose,
  onSaved,
}: {
  template: NotificationTemplate | null
  onClose: () => void
  onSaved: (template: NotificationTemplate) => void
}) {
  const [key, setKey] = useState(template?.key ?? '')
  const [channel, setChannel] = useState<NotificationChannel>(template?.channel ?? 'push')
  const [title, setTitle] = useState(template?.title ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [status, setStatus] = useState(template?.status ?? 'active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = { key, channel, title, body, status }
      const saved = template ? await updateNotificationTemplate(template.id, payload) : await createNotificationTemplate(payload)
      onSaved(saved)
    } catch (err) {
      setError(errMessage(err, 'Could not save template'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`${template ? 'Edit' : 'Add'} notification template`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Key</span>
          <input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. booking_confirmed" className="input" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Channel</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} className="input">
            <option value="push">Push</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Body</span>
          <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
          <span className="mt-1 block text-xs text-navy-300">Use {'{{variable}}'} placeholders, e.g. {'{{customerName}}'}.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {template ? 'Save changes' : 'Create template'}
        </button>
      </form>
    </Modal>
  )
}
