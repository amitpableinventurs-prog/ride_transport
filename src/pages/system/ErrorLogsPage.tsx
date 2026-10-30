import { useEffect, useState } from 'react'
import { AlertTriangle, Bug, CheckCheck, Clock, Search } from 'lucide-react'
import { fetchErrorLog, fetchErrorLogs, fetchErrorLogSummary, resolveSimilarErrorLogs, setErrorLogStatus } from '@/api/errorLogs'
import type { ErrorLevel, ErrorLogEntry, ErrorLogList, ErrorLogSummary, ErrorSource } from '@/types/errorLogs'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { Pagination } from '@/components/common/Pagination'
import { PermissionGate } from '@/components/common/PermissionGate'
import { StatCard } from '@/components/common/StatCard'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })

const SOURCE_LABELS: Record<ErrorSource, string> = {
  customer_app: 'Customer app',
  rider_app: 'Rider app',
  partner_app: 'Partner app',
  api: 'API',
}

function levelTone(level: ErrorLevel): 'danger' | 'warning' | 'neutral' {
  if (level === 'fatal') return 'danger'
  if (level === 'error') return 'warning'
  return 'neutral'
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

const selectClass = 'rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400'

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-navy-400">{label}</span>
      <span className="break-all text-navy-700">{value}</span>
    </div>
  )
}

function ErrorLogDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string
  onClose: () => void
  onChanged: () => void
}) {
  const [log, setLog] = useState<ErrorLogEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchErrorLog(id)
      .then(setLog)
      .catch(() => setError('Could not load this error log.'))
  }, [id])

  async function run(action: () => Promise<string | void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const message = await action()
      if (message) setNotice(message)
      onChanged()
    } catch (err) {
      setError(apiMessage(err, 'Could not update this error log.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Error details" onClose={onClose} wide>
      {!log ? (
        error ? <p className="text-sm text-brand-red">{error}</p> : <LoadingScreen />
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={levelTone(log.level)}>{log.level}</Badge>
            <Badge tone="info">{SOURCE_LABELS[log.source]}</Badge>
            <Badge tone={log.status === 'resolved' ? 'success' : 'warning'}>{log.status}</Badge>
          </div>
          <p className="break-words font-medium text-navy-800">{log.message}</p>

          <div className="space-y-1.5">
            <DetailRow label="Occurred" value={dateFmt.format(new Date(log.occurredAt))} />
            <DetailRow label="Received" value={dateFmt.format(new Date(log.createdAt))} />
            <DetailRow label="Screen / route" value={log.screen} />
            <DetailRow label="Platform" value={log.platform} />
            <DetailRow label="App version" value={log.appVersion} />
            <DetailRow label="OS version" value={log.osVersion} />
            <DetailRow label="Device" value={log.deviceModel} />
            <DetailRow
              label="User"
              value={log.userName || log.userPhone ? [log.userName, log.userPhone, log.userType && `(${log.userType})`].filter(Boolean).join(' ') : null}
            />
            <DetailRow label="IP" value={log.ip} />
            {log.status === 'resolved' && (
              <DetailRow
                label="Resolved"
                value={[log.resolvedBy, log.resolvedAt && dateFmt.format(new Date(log.resolvedAt))].filter(Boolean).join(' · ')}
              />
            )}
          </div>

          {log.context && Object.keys(log.context).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-navy-400">Context</p>
              <div className="space-y-1 rounded-lg bg-navy-50/60 p-3">
                {Object.entries(log.context).map(([key, value]) => (
                  <DetailRow key={key} label={key} value={String(value)} />
                ))}
              </div>
            </div>
          )}

          {log.stack && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-navy-400">Stack trace</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-navy-50">{log.stack}</pre>
            </div>
          )}

          {error && <p className="text-sm text-brand-red">{error}</p>}
          {notice && <p className="text-sm text-brand-green-dark">{notice}</p>}

          <PermissionGate permission="error_logs.manage">
            <div className="flex flex-wrap justify-end gap-2 border-t border-navy-100 pt-4">
              {log.status === 'open' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const { resolved } = await resolveSimilarErrorLogs(log.id)
                        setLog({ ...log, status: 'resolved' })
                        return `Resolved ${resolved} open log${resolved === 1 ? '' : 's'} with this message.`
                      })
                    }
                    className="rounded-lg border border-navy-100 px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                  >
                    Resolve all like this
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(async () => setLog(await setErrorLogStatus(log.id, 'resolved')))}
                    className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(async () => setLog(await setErrorLogStatus(log.id, 'open')))}
                  className="rounded-lg border border-navy-100 px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          </PermissionGate>
        </div>
      )}
    </Modal>
  )
}

export function ErrorLogsPage() {
  const [result, setResult] = useState<ErrorLogList | null>(null)
  const [summary, setSummary] = useState<ErrorLogSummary | null>(null)
  const [source, setSource] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('open')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function load() {
    fetchErrorLogs({ source: source || undefined, level: level || undefined, status: status || undefined, q: search || undefined, page, limit: pageSize })
      .then(setResult)
      .catch(() => setError('Could not load error logs.'))
    fetchErrorLogSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, level, status, search, page, pageSize])

  function filterSetter(set: (value: string) => void) {
    return (value: string) => {
      set(value)
      setPage(1)
    }
  }

  if (!result) return error ? <p className="text-sm text-brand-red">{error}</p> : <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Error Logs</h1>
        <p className="text-sm text-navy-400">Crashes reported by the customer, rider and partner apps, and unexpected API errors. Kept for 90 days.</p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Open errors" value={String(summary.open)} icon={Bug} accent="orange" />
          <StatCard label="Open fatal" value={String(summary.openFatal)} icon={AlertTriangle} accent="red" hint="App crashes" />
          <StatCard label="Last 24 hours" value={String(summary.last24h)} icon={Clock} hint="Open and resolved" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search message, screen, user, version…"
            className="w-full rounded-lg border border-navy-100 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-400"
          />
        </div>
        <select value={source} onChange={(e) => filterSetter(setSource)(e.target.value)} className={selectClass} aria-label="Source">
          <option value="">All sources</option>
          {(Object.keys(SOURCE_LABELS) as ErrorSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
              {summary ? ` (${summary.openBySource[s]} open)` : ''}
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => filterSetter(setLevel)(e.target.value)} className={selectClass} aria-label="Level">
          <option value="">All levels</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
        </select>
        <select value={status} onChange={(e) => filterSetter(setStatus)(e.target.value)} className={selectClass} aria-label="Status">
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="">All statuses</option>
        </select>
      </div>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Occurred</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Level</th>
              <th className="px-5 py-3 font-medium">Message</th>
              <th className="px-5 py-3 font-medium">User / device</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((log) => (
              <tr key={log.id} onClick={() => setSelectedId(log.id)} className="cursor-pointer border-b border-navy-50 last:border-0 hover:bg-navy-50/40">
                <td className="whitespace-nowrap px-5 py-3 text-navy-500">{dateFmt.format(new Date(log.occurredAt))}</td>
                <td className="whitespace-nowrap px-5 py-3 text-navy-600">{SOURCE_LABELS[log.source]}</td>
                <td className="px-5 py-3">
                  <Badge tone={levelTone(log.level)}>{log.level}</Badge>
                </td>
                <td className="max-w-md px-5 py-3">
                  <p className="truncate text-navy-800" title={log.message}>
                    {log.message}
                  </p>
                  {log.screen && <p className="truncate text-xs text-navy-300">{log.screen}</p>}
                </td>
                <td className="px-5 py-3">
                  <p className="text-navy-700">{log.userName || log.userPhone || <span className="text-navy-300">—</span>}</p>
                  <p className="text-xs text-navy-300">{[log.platform, log.appVersion, log.deviceModel].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="px-5 py-3">
                  {log.status === 'resolved' ? (
                    <Badge tone="success">
                      <CheckCheck size={12} /> resolved
                    </Badge>
                  ) : (
                    <Badge tone="warning">open</Badge>
                  )}
                </td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-navy-300">
                  No matching error logs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={result.total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />

      {selectedId && <ErrorLogDetail id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
    </div>
  )
}
