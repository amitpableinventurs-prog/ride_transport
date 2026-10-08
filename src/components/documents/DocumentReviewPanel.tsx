import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, XCircle } from 'lucide-react'
import { fetchDocuments, updateDocumentStatus } from '@/api/documents'
import { fileHref, isPdf } from '@/api/files'
import type { DocumentOwnerType, DocumentRecord, DocumentStatus } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { PermissionGate } from '@/components/common/PermissionGate'

const STATUS_TONE: Record<DocumentStatus, 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  expired: 'danger',
}

const DOC_LABELS: Record<string, string> = {
  driving_license: 'Driving licence',
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  vehicle_rc: 'Vehicle RC',
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })

export interface DocumentSource {
  ownerType: DocumentOwnerType
  ownerId: string
  /** Only show these document types from this owner (e.g. the RC filed under a driver). */
  docTypes?: string[]
}

/** Lists an account's documents with the files, so an admin can open each one and verify or reject it. */
export function DocumentReviewPanel({ sources, onLoaded }: { sources: DocumentSource[]; onLoaded?: (docs: DocumentRecord[]) => void }) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const key = sources.map((s) => `${s.ownerType}:${s.ownerId}:${(s.docTypes ?? []).join(',')}`).join('|')

  useEffect(() => {
    let alive = true
    Promise.all(sources.map((s) => fetchDocuments({ ownerType: s.ownerType, ownerId: s.ownerId, limit: 100 })))
      .then((results) => {
        if (!alive) return
        const merged = results.flatMap((r, i) => r.items.filter((d) => !sources[i].docTypes || sources[i].docTypes!.includes(d.docType)))
        setDocs(merged)
        onLoaded?.(merged)
      })
      .catch(() => alive && setError('Could not load documents.'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function review(doc: DocumentRecord, patch: { status: 'verified' | 'rejected'; rejectionReason?: string }) {
    setBusyId(doc.id)
    setError(null)
    try {
      const updated = await updateDocumentStatus(doc.id, patch)
      const next = docs!.map((d) => (d.id === doc.id ? updated : d))
      setDocs(next)
      onLoaded?.(next)
      setRejecting(null)
      setReason('')
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!docs) return <p className="text-sm text-navy-400">{error ?? 'Loading documents…'}</p>

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}
      {docs.length === 0 && <p className="rounded-lg bg-navy-50 px-3 py-3 text-sm text-navy-400">No documents uploaded yet.</p>}
      {docs.map((doc) => (
        <div key={doc.id} className="rounded-xl border border-navy-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-navy-800">{DOC_LABELS[doc.docType] ?? doc.docType}</p>
              <p className="text-xs text-navy-400">
                {doc.docNumber ? `No. ${doc.docNumber}` : 'No number'}
                {doc.expiryDate ? ` · Expires ${dateFmt.format(new Date(doc.expiryDate))}` : ''}
              </p>
            </div>
            <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <FilePreview label="Front" url={doc.fileUrl} />
            {doc.backUrl && <FilePreview label="Back" url={doc.backUrl} />}
          </div>

          {doc.status === 'rejected' && doc.rejectionReason && <p className="mt-2 text-xs text-brand-red">Reason: {doc.rejectionReason}</p>}

          <PermissionGate permission="fleet.manage">
            {rejecting === doc.id ? (
              <div className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this document rejected?"
                  className="min-w-0 flex-1 rounded-lg border border-navy-100 px-3 py-1.5 text-sm outline-none focus:border-navy-400"
                />
                <button
                  disabled={!reason.trim() || busyId === doc.id}
                  onClick={() => review(doc, { status: 'rejected', rejectionReason: reason.trim() })}
                  className="rounded-lg bg-brand-red px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Reject
                </button>
                <button onClick={() => setRejecting(null)} className="rounded-lg border border-navy-100 px-3 py-1.5 text-xs text-navy-600">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-3 flex gap-1.5">
                {doc.status !== 'verified' && (
                  <button
                    onClick={() => review(doc, { status: 'verified' })}
                    disabled={busyId === doc.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-green-dark hover:bg-green-50 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Verify
                  </button>
                )}
                {doc.status !== 'rejected' && (
                  <button
                    onClick={() => setRejecting(doc.id)}
                    disabled={busyId === doc.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                )}
              </div>
            )}
          </PermissionGate>
        </div>
      ))}
    </div>
  )
}

function FilePreview({ label, url }: { label: string; url: string }) {
  const href = fileHref(url)
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group block w-36">
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-navy-100 bg-navy-50">
        {isPdf(url) ? <FileText size={28} className="text-navy-300" /> : <img src={href} alt={label} className="h-full w-full object-cover" />}
      </div>
      <span className="mt-1 inline-flex items-center gap-1 text-xs text-navy-500 group-hover:text-brand-orange">
        {label} <ExternalLink size={11} />
      </span>
    </a>
  )
}

/** How many documents still lack a verified status. Null until the documents have loaded. */
export function unverifiedCount(docs: DocumentRecord[] | null): number | null {
  return docs ? docs.filter((d) => d.status !== 'verified').length : null
}
