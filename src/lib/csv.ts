// Client-side CSV export shared by every /reports/* page. Builds a CSV string
// from an array of flat row objects (keys become the header row) and triggers
// a browser download via a Blob + temporary <a download> element.
function escapeCsvValue(value: string | number): string {
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) {
    return
  }

  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? '')).join(',')),
  ]
  const csvContent = lines.join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
