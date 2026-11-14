import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch {
      // error surfaced via store
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-800 px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <img
            src={`${import.meta.env.BASE_URL}brand/anz-logo.png`}
            alt="AnZ Cabs & Logistics — Connecting People. Moving Possibilities."
            width={800}
            height={490}
            className="h-auto w-60 rounded-3xl bg-white p-4 shadow-xl shadow-black/40 ring-1 ring-white/10"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">AnZ Cabs Admin</h1>
            <p className="mt-1 text-sm text-navy-300">Ride &amp; Transport Platform Control Center</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/30 sm:p-8">
          <h2 className="text-lg font-semibold text-navy-800">Sign in to your account</h2>
          <p className="mt-1 text-sm text-navy-400">Enter your admin email and password.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-navy-700">
                Email
              </label>
              <div className="relative">
                <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-navy-100 py-2.5 pl-10 pr-3.5 text-sm text-navy-800 outline-none transition-colors focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-navy-700">
                Password
              </label>
              <div className="relative">
                <Lock size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-navy-100 py-2.5 pl-10 pr-10 text-sm text-navy-800 outline-none transition-colors focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-dark disabled:opacity-60"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-navy-300">
            <ShieldCheck size={14} /> Authorized personnel only
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">© {new Date().getFullYear()} AnZ Cabs. All rights reserved.</p>
      </div>
    </div>
  )
}
