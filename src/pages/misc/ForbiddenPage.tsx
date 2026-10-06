import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-brand-red">
        <ShieldAlert size={26} />
      </div>
      <h1 className="text-lg font-semibold text-navy-800">Access restricted</h1>
      <p className="mt-1.5 max-w-sm text-sm text-navy-400">
        Your role doesn't have permission to view this page. Contact a Super Admin if you believe this is a mistake.
      </p>
      <Link to="/dashboard" className="mt-5 rounded-lg bg-navy-500 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600">
        Back to dashboard
      </Link>
    </div>
  )
}
