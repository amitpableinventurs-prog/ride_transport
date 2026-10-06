import { useEffect, useState, type FormEvent } from 'react'
import { Star } from 'lucide-react'
import { fetchRatings } from '@/api/ratings'
import type { Rating } from '@/types/marketing'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function displayName(value: { id: string; name?: string; bookingCode?: string } | string | null | undefined, key: 'name' | 'bookingCode') {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return (value as Record<string, string>)[key] ?? '—'
}

export function RatingsPage() {
  const [ratings, setRatings] = useState<Rating[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ratedBy, setRatedBy] = useState('')
  const [minScore, setMinScore] = useState('')

  async function load() {
    setRatings(await fetchRatings({ ratedBy: ratedBy || undefined, minScore: minScore ? Number(minScore) : undefined }))
  }

  useEffect(() => {
    load().catch(() => setError('Could not load ratings.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilter(e: FormEvent) {
    e.preventDefault()
    load().catch(() => setError('Could not load ratings.'))
  }

  if (!ratings) return <LoadingScreen />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Ratings</h1>
        <p className="text-sm text-navy-400">Customer and driver ratings submitted after completed bookings.</p>
      </div>

      <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Rated by</span>
          <select value={ratedBy} onChange={(e) => setRatedBy(e.target.value)} className="input">
            <option value="">All</option>
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-navy-600">Min score</span>
          <select value={minScore} onChange={(e) => setMinScore(e.target.value)} className="input">
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                {s}+
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-navy-100 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-50">
          Filter
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Booking</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Driver</th>
              <th className="px-5 py-3 font-medium">Rated by</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Comment</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {ratings.map((rating) => (
              <tr key={rating.id} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-mono text-xs text-navy-600">{displayName(rating.booking, 'bookingCode')}</td>
                <td className="px-5 py-3 text-navy-700">{displayName(rating.customer, 'name')}</td>
                <td className="px-5 py-3 text-navy-700">{displayName(rating.driver, 'name')}</td>
                <td className="px-5 py-3">
                  <Badge tone="neutral">{rating.ratedBy}</Badge>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1 font-medium text-navy-800">
                    <Star size={14} className="fill-brand-orange text-brand-orange" /> {rating.score.toFixed(1)} / 5
                  </span>
                </td>
                <td className="px-5 py-3 max-w-xs truncate text-navy-500">{rating.comment || '—'}</td>
                <td className="px-5 py-3 text-navy-500">{dateFmt.format(new Date(rating.createdAt))}</td>
              </tr>
            ))}
            {ratings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-navy-300">
                  No ratings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
