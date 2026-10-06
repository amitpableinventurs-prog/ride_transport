import { useEffect, useState } from 'react'
import { fetchSosRequests, updateSosRequest } from '@/api/sos'
import type { SosRequest } from '@/types/booking'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function statusTone(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'resolved') return 'success'
  if (status === 'acknowledged') return 'warning'
  return 'danger'
}

function locationLabel(location: SosRequest['location']): string {
  if (location?.lat == null || location?.lng == null) return '—'
  return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
}

export function SosPage() {
  const [requests, setRequests] = useState<SosRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSosRequests()
      .then(setRequests)
      .catch(() => setError('Could not load SOS requests.'))
  }, [])

  async function handleUpdate(id: string, status: 'acknowledged' | 'resolved') {
    setBusyId(id)
    setError(null)
    try {
      const updated = await updateSosRequest(id, { status, note: notes[id]?.trim() || undefined })
      setRequests((prev) => (prev ? prev.map((r) => (r.id === id ? updated : r)) : prev))
      setNotes((prev) => ({ ...prev, [id]: '' }))
    } catch {
      setError('Could not update SOS request.')
    } finally {
      setBusyId(null)
    }
  }

  if (!requests) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">SOS</h1>
        <p className="text-sm text-navy-400">Emergency alerts raised by customers and drivers.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Raised by</th>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Location</th>
              <th className="px-5 py-3 font-medium">Raised at</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-navy-50 align-top last:border-0">
                <td className="px-5 py-3 capitalize text-navy-600">{r.raisedBy}</td>
                <td className="px-5 py-3 text-navy-800">{r.userName}</td>
                <td className="px-5 py-3">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-500">{locationLabel(r.location)}</td>
                <td className="px-5 py-3 text-navy-500">{dateFmt.format(new Date(r.createdAt))}</td>
                <td className="px-5 py-3">
                  <PermissionGate permission="bookings.manage" fallback={<span className="text-xs text-navy-300">—</span>}>
                    {r.status !== 'resolved' ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          value={notes[r.id] ?? ''}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Note (optional)"
                          className="w-40 rounded-lg border border-navy-100 px-2 py-1 text-xs outline-none focus:border-navy-400"
                        />
                        <div className="flex gap-1.5">
                          {r.status === 'open' && (
                            <button
                              onClick={() => handleUpdate(r.id, 'acknowledged')}
                              disabled={busyId === r.id}
                              className="rounded-lg border border-navy-100 px-2 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdate(r.id, 'resolved')}
                            disabled={busyId === r.id}
                            className="rounded-lg bg-brand-green px-2 py-1 text-xs font-medium text-white hover:bg-brand-green-dark disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-navy-300">
                        Resolved{r.resolvedAt ? ` ${dateFmt.format(new Date(r.resolvedAt))}` : ''}
                      </span>
                    )}
                  </PermissionGate>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-navy-300">
                  No SOS requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
