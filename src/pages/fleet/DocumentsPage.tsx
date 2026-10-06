import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import { fetchDocuments, updateDocumentStatus } from '@/api/documents'
import type { DocumentOwnerType, DocumentRecord, DocumentStatus } from '@/types/entities'
import { Badge } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'

const STATUS_TONE: Record<DocumentStatus, 'success' | 'warning' | 'danger'> = {
  verified: 'success',
  pending: 'warning',
  rejected: 'danger',
  expired: 'danger',
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const LIMIT = 20

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [ownerType, setOwnerType] = useState<DocumentOwnerType | ''>('')
  const [status, setStatus] = useState<DocumentStatus | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DocumentRecord | null>(null)

  async function load() {
    const data = await fetchDocuments({ page, limit: LIMIT, ownerType: ownerType || undefined, status: status || undefined })
    setDocuments(data.items)
    setTotal(data.total)
  }

  useEffect(() => {
    load().catch(() => setError('Could not load documents.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ownerType, status])

  async function verify(doc: DocumentRecord) {
    setBusyId(doc.id)
    try {
      const updated = await updateDocumentStatus(doc.id, { status: 'verified' })
      setDocuments((prev) => prev!.map((d) => (d.id === doc.id ? updated : d)))
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(doc: DocumentRecord, rejectionReason: string) {
    setBusyId(doc.id)
    try {
      const updated = await updateDocumentStatus(doc.id, { status: 'rejected', rejectionReason })
      setDocuments((prev) => prev!.map((d) => (d.id === doc.id ? updated : d)))
      setRejectTarget(null)
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Documents</h1>
        <p className="text-sm text-navy-400">KYC and compliance documents submitted by drivers, partners and for vehicles.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={ownerType}
          onChange={(e) => {
            setPage(1)
            setOwnerType(e.target.value as DocumentOwnerType | '')
          }}
          className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        >
          <option value="">All owner types</option>
          <option value="driver">Driver</option>
          <option value="partner">Transport Partner</option>
          <option value="vehicle">Vehicle</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value as DocumentStatus | '')
          }}
          className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      {!documents ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-5 py-3 font-medium">Owner type</th>
                  <th className="px-5 py-3 font-medium">Owner ID</th>
                  <th className="px-5 py-3 font-medium">Doc type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Expiry</th>
                  <th className="px-5 py-3 font-medium">Uploaded</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-navy-300">
                      No documents found.
                    </td>
                  </tr>
                )}
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-5 py-3 text-navy-600 capitalize">{doc.ownerType}</td>
                    <td className="px-5 py-3 font-mono text-xs text-navy-500">{doc.ownerId}</td>
                    <td className="px-5 py-3 text-navy-600">{doc.docType}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-navy-600">{doc.expiryDate ? dateFmt.format(new Date(doc.expiryDate)) : '—'}</td>
                    <td className="px-5 py-3 text-navy-600">{dateFmt.format(new Date(doc.createdAt))}</td>
                    <td className="px-5 py-3 text-right">
                      <PermissionGate permission="fleet.manage">
                        {doc.status === 'pending' || doc.status === 'expired' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => verify(doc)}
                              disabled={busyId === doc.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-green-dark hover:bg-green-50 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} /> Verify
                            </button>
                            <button
                              onClick={() => setRejectTarget(doc)}
                              disabled={busyId === doc.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-navy-100 px-2 py-1.5 text-xs font-medium text-brand-red hover:bg-red-50 disabled:opacity-50"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-navy-300">—</span>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-navy-400">
            <span>
              Page {page} of {totalPages} &middot; {total} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-navy-100 p-1.5 hover:bg-navy-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-navy-100 p-1.5 hover:bg-navy-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {rejectTarget && (
        <RejectDocumentModal
          document={rejectTarget}
          submitting={busyId === rejectTarget.id}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => reject(rejectTarget, reason)}
        />
      )}
    </div>
  )
}

function RejectDocumentModal({
  document,
  submitting,
  onClose,
  onConfirm,
}: {
  document: DocumentRecord
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(reason.trim())
  }

  return (
    <Modal title={`Reject ${document.docType}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-600">Rejection reason</label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400"
            placeholder="Explain why this document is being rejected"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-red py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Reject document
        </button>
      </form>
    </Modal>
  )
}
