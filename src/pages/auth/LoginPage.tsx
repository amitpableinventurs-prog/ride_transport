import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import type { OtpChallenge } from '@/types/auth'

export function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const otpChallenge = useAuthStore((s) => s.otpChallenge)
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
      const result = await login(email, password)
      if (result === 'authenticated') navigate(redirectTo, { replace: true })
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
            src="/brand/anz-logo.png"
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
          {otpChallenge ? (
            <OtpStep challenge={otpChallenge} onVerified={() => navigate(redirectTo, { replace: true })} />
          ) : (
            <>
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
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">© {new Date().getFullYear()} AnZ Cabs. All rights reserved.</p>
      </div>
    </div>
  )
}

function useCountdown(seconds: number, resetKey: unknown) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
    const timer = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [seconds, resetKey])

  return remaining
}

function OtpStep({ challenge, onVerified }: { challenge: OtpChallenge; onVerified: () => void }) {
  const error = useAuthStore((s) => s.error)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const resendOtp = useAuthStore((s) => s.resendOtp)
  const cancelOtp = useAuthStore((s) => s.cancelOtp)

  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)

  // Resetting on devOtp/expiresInSeconds changes restarts both timers after a resend.
  const resetKey = `${challenge.devOtp ?? ''}:${challenge.expiresInSeconds}:${challenge.resendAfterSeconds}`
  const resendIn = useCountdown(challenge.resendAfterSeconds, resetKey)
  const expiresIn = useCountdown(challenge.expiresInSeconds, resetKey)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await verifyOtp(otp)
      onVerified()
    } catch {
      setOtp('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await resendOtp()
      setOtp('')
    } catch {
      // error surfaced via store
    } finally {
      setResending(false)
    }
  }

  const mm = String(Math.floor(expiresIn / 60)).padStart(2, '0')
  const ss = String(expiresIn % 60).padStart(2, '0')

  return (
    <>
      <button type="button" onClick={cancelOtp} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-navy-400 hover:text-navy-600">
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand-orange" />
        <h2 className="text-lg font-semibold text-navy-800">Verify it's you</h2>
      </div>
      <p className="mt-1 text-sm text-navy-400">
        Enter the 6-digit code sent by SMS to your registered phone <span className="font-medium text-navy-600">{challenge.maskedPhone}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          autoFocus
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          aria-label="One-time password"
          className="w-full rounded-lg border border-navy-100 px-3.5 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-navy-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
        />

        <p className="text-center text-xs text-navy-400">
          {expiresIn > 0 ? (
            <>
              Code expires in <span className="font-medium text-navy-600">{mm}:{ss}</span>
            </>
          ) : (
            <span className="text-brand-red">Code expired. Request a new one.</span>
          )}
        </p>

        {challenge.devOtp && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-center text-xs text-brand-orange-dark">
            Development mode: your OTP is <span className="font-semibold tracking-wider">{challenge.devOtp}</span>
          </p>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting || otp.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-orange-dark disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Verify &amp; sign in
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-navy-400">
        Didn't get the code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || resending}
          className="font-medium text-brand-orange hover:text-brand-orange-dark disabled:cursor-not-allowed disabled:text-navy-300"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : resending ? 'Sending…' : 'Resend OTP'}
        </button>
      </div>
    </>
  )
}
