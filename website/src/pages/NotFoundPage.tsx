import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'

export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <section className="bg-ink-950 py-24 text-center text-white">
      <div className="container-x">
        <p className="font-display text-6xl font-semibold text-brand-400">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">This page took a wrong turn</h1>
        <p className="mt-2 text-white/60">The page you are looking for does not exist.</p>
        <Link to="/" className="btn-brand mt-8">
          Back to home
        </Link>
      </div>
    </section>
  )
}
