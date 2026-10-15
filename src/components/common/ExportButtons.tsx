import { useState } from 'react'
import { Download, Loader2, Printer } from 'lucide-react'
import { downloadCsv } from '@/lib/csv'
import { openPrintWindow, printTable } from '@/lib/print'

type Row = Record<string, string | number>

interface Props {
  /** Page name, used for the print title and the CSV file name. */
  title: string
  /** Applied filters, shown under the print title. */
  subtitle?: string
  /** Every row matching the current filters (not only the visible page). */
  loadRows: () => Promise<Row[]>
  disabled?: boolean
}

/** "Export CSV" and "Print" for an admin list; both use every row that matches the filters. */
export function ExportButtons({ title, subtitle, loadRows, disabled = false }: Props) {
  const [busy, setBusy] = useState<'csv' | 'print' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function exportCsv() {
    setBusy('csv')
    setError(null)
    try {
      const rows = await loadRows()
      if (!rows.length) {
        setError('Nothing to export.')
        return
      }
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      downloadCsv(`${slug}_${new Date().toISOString().slice(0, 10)}`, rows)
    } catch {
      setError('Could not export. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function print() {
    // Opened before loading: a window opened after an await is blocked as a pop-up.
    const win = openPrintWindow()
    if (!win) {
      setError('Allow pop-ups for this site to print.')
      return
    }
    setBusy('print')
    setError(null)
    try {
      const rows = await loadRows()
      printTable(win, { title: `AnZ Cabs — ${title}`, subtitle: [`${rows.length} records`, subtitle].filter(Boolean).join(' · '), rows })
    } catch {
      win.close()
      setError('Could not load the data for printing. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const button =
    'flex items-center gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-50'

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" onClick={exportCsv} disabled={disabled || busy !== null} className={button}>
          {busy === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export CSV
        </button>
        <button type="button" onClick={print} disabled={disabled || busy !== null} className={button}>
          {busy === 'print' ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Print
        </button>
      </div>
      {error && <p className="text-xs text-brand-red">{error}</p>}
    </div>
  )
}
