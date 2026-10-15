import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Shows the rows-per-page picker when given. */
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

/** Page numbers around the current page, with gaps marked as null: 1 … 4 5 6 … 12. */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(page - 1, totalPages - 4))
  const end = Math.min(totalPages - 1, Math.max(page + 1, 5))
  const pages: (number | null)[] = [1]
  if (start > 2) pages.push(null)
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < totalPages - 1) pages.push(null)
  pages.push(totalPages)
  return pages
}

const navButton = 'flex h-8 min-w-8 items-center justify-center rounded-lg border border-navy-100 px-2 text-navy-500 hover:bg-navy-50 disabled:pointer-events-none disabled:opacity-40'

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 20, 50, 100] }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col gap-3 text-sm text-navy-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          Showing <span className="font-medium text-navy-700">{from}</span>–<span className="font-medium text-navy-700">{to}</span> of{' '}
          <span className="font-medium text-navy-700">{total}</span>
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1 text-sm text-navy-700"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        <button type="button" className={navButton} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page">
          <ChevronsLeft size={16} />
        </button>
        <button type="button" className={navButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-navy-300">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={clsx(navButton, p === page && 'border-navy-800 bg-navy-800 font-semibold text-white hover:bg-navy-800')}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={navButton} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
        <button type="button" className={navButton} onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="Last page">
          <ChevronsRight size={16} />
        </button>
      </nav>
    </div>
  )
}
