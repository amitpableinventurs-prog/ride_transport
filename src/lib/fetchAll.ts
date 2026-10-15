// Loads every row of a paginated admin list (for CSV export and print), 100 per request,
// which is the most the list APIs return at once.
const PAGE_SIZE = 100

export async function fetchAllPages<T>(fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>): Promise<T[]> {
  const first = await fetchPage(1, PAGE_SIZE)
  const items = [...first.items]
  const pages = Math.ceil(first.total / PAGE_SIZE)
  for (let page = 2; page <= pages; page++) {
    items.push(...(await fetchPage(page, PAGE_SIZE)).items)
  }
  return items
}
