import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-navy-200">404</p>
      <h1 className="mt-2 text-lg font-semibold text-navy-800">Page not found</h1>
      <Link to="/dashboard" className="mt-5 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-dark">
        Back to dashboard
      </Link>
    </div>
  )
}
