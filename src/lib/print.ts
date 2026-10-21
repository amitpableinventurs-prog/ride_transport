// Prints a table in its own window, so the admin layout (sidebar, filters, buttons) stays out of the printout.

export interface PrintDocument {
  title: string
  subtitle?: string
  /** Headline figures shown above the table, e.g. a report's stat cards. */
  summary?: { label: string; value: string | number }[]
  /** Flat rows; the keys of the first row are the column headers. */
  rows: Record<string, string | number>[]
}

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Opens the print window. Call it straight from the click handler (before any await),
 * otherwise the browser blocks it as a pop-up. Returns null when it was blocked anyway.
 */
export function openPrintWindow(): Window | null {
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (win) win.document.write('<p style="font-family:sans-serif;padding:24px;color:#4a5f8f">Preparing the print view…</p>')
  return win
}

export function printTable(win: Window, doc: PrintDocument): void {
  const { title, subtitle, summary = [], rows } = doc
  const headers = rows.length ? Object.keys(rows[0]) : []
  const body = rows.length
    ? rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty">No records.</td></tr>`
  const summaryHtml = summary.length
    ? `<div class="summary">${summary.map((s) => `<div><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`).join('')}</div>`
    : ''
  const meta = [subtitle, `Printed ${dateTimeFmt.format(new Date())}`].filter(Boolean).join(' · ')

  win.document.open()
  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0c1424; margin: 24px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  header img { height: 48px; width: auto; }
  h1 { font-size: 18px; margin: 0; }
  p { margin: 2px 0 0; font-size: 12px; color: #4a5f8f; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .summary div { border: 1px solid #d4dbe8; border-radius: 8px; padding: 8px 12px; min-width: 140px; }
  .summary span { display: block; font-size: 11px; color: #4a5f8f; }
  .summary strong { font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #d4dbe8; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #eef1f6; font-weight: 600; }
  tr, .summary div { break-inside: avoid; }
  td.empty { text-align: center; color: #7e93ba; padding: 16px; }
  @page { size: landscape; margin: 12mm; }
  @media print { body { margin: 0; } th, .summary div { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <header>
    <img src="${window.location.origin}/brand/anz-logo.png" alt="">
    <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(meta)}</p></div>
  </header>
  ${summaryHtml}
  <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
</body></html>`)
  win.document.close()
  win.focus()
  // Wait for the logo so it is in the printout.
  const img = win.document.querySelector('img')
  const print = () => win.print()
  if (img && !img.complete) {
    img.addEventListener('load', print, { once: true })
    img.addEventListener('error', print, { once: true })
  } else {
    print()
  }
}

/** For data already on screen: opens the window and prints at once. Returns false when pop-ups are blocked. */
export function printDocument(doc: PrintDocument): boolean {
  const win = openPrintWindow()
  if (!win) return false
  printTable(win, doc)
  return true
}
