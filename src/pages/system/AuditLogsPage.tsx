import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchAuditLogs } from '@/api/auditLogs'
import type { AuditLogEntry } from '@/types/audit'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Badge } from '@/components/common/Badge'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })

function actionTone(action: string): 'danger' | 'warning' | 'success' | 'neutral' {
  if (action.includes('status_changed') || action.includes('delete')) return 'danger'
  if (action.includes('updated') || action.includes('permissions')) return 'warning'
  if (action.includes('create') || action.includes('login')) return 'success'
  return 'neutral'
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLogs()
      .then(setLogs)
      .catch(() => setError('Could not load audit logs.'))
  }, [])

  const filtered = useMemo(() => {
    if (!logs) return []
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((l) =>
      [l.actorName, l.actorRole, l.action, l.targetType, l.targetLabel].some((v) => v.toLowerCase().includes(q)),
    )
  }, [logs, query])

  if (!logs) return error ? <p className="text-sm text-brand-red">{error}</p> : <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Audit Logs</h1>
        <p className="text-sm text-navy-400">Admin logins and sensitive create/update/delete actions.</p>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by admin, action or target…"
          className="w-full rounded-lg border border-navy-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Timestamp</th>
              <th className="px-5 py-3 font-medium">Admin</th>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 whitespace-nowrap text-navy-500">{dateFmt.format(new Date(log.createdAt))}</td>
                <td className="px-5 py-3">
                  <p className="text-navy-800">{log.actorName}</p>
                  <p className="text-xs text-navy-300">{log.actorRole}</p>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-600">
                  <span className="text-navy-400">{log.targetType}:</span> {log.targetLabel}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-navy-300">
                  No matching audit log entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
