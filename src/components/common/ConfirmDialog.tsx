import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface Props {
  title: string
  children: ReactNode
  confirmLabel: string
  /** Button text while the action runs. */
  busyLabel?: string
  /** Runs the action; a thrown error's API message is shown in the dialog, which stays open for a retry. */
  onConfirm: () => Promise<void>
  onClose: () => void
}

function errorMessage(err: unknown) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Something went wrong. Please try again.'
}

/** In-app replacement for window.confirm on destructive actions: shows progress and errors without closing. */
export function ConfirmDialog({ title, children, confirmLabel, busyLabel = 'Working…', onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4" onClick={() => !busy && onClose()}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand-red">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
            <div className="mt-1.5 text-sm text-navy-500">{children}</div>
          </div>
          <button onClick={onClose} disabled={busy} className="text-navy-300 hover:text-navy-600 disabled:opacity-40" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mx-5 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-navy-100 px-5 py-4">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-navy-100 px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-70"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
