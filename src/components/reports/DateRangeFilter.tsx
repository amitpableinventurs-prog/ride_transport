import { Download } from 'lucide-react'

interface DateRangeFilterProps {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onExport: () => void
  exportDisabled?: boolean
  exportLabel?: string
}

// Shared by every /reports/* page: two date inputs plus an "Export CSV"
// button. Filtering happens as soon as from/to change (pages re-fetch in a
// useEffect keyed on these values); the button just dumps whatever rows are
// currently on screen via lib/csv.ts.
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onExport,
  exportDisabled = false,
  exportLabel = 'Export CSV',
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-navy-400">From</label>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-navy-400">To</label>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-700 outline-none focus:border-navy-400"
        />
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="ml-auto inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download size={16} />
        {exportLabel}
      </button>
    </div>
  )
}
