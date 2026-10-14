import axios from 'axios'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/api/client'
import type { AuthUser, LoginResponse, LoginResult, OtpChallenge } from '@/types/auth'
import type { PermissionKey } from '@/types/rbac'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  error: string | null
  /** Set after a correct password when the backend requires an OTP to finish signing in. */
  otpChallenge: OtpChallenge | null
  login: (email: string, password: string) => Promise<'authenticated' | 'otp_required'>
  verifyOtp: (otp: string) => Promise<void>
  resendOtp: () => Promise<void>
  cancelOtp: () => void
  logout: () => Promise<void>
  bootstrap: () => Promise<void>
  refreshAccessToken: () => Promise<string | null>
  clearSession: () => void
  hasPermission: (permission: PermissionKey) => boolean
}

const STORAGE_KEY = 'rideflow-admin-auth'

function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

const isUnauthorized = (err: unknown) => axios.isAxiosError(err) && err.response?.status === 401

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The refresh token as last saved by any tab, or undefined when storage cannot be read. */
function storedRefreshToken(): string | null | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? ((JSON.parse(raw) as { state?: { refreshToken?: string | null } }).state?.refreshToken ?? null) : null
  } catch {
    return undefined
  }
}

// Refresh tokens are single-use: the server ends the whole session when one is sent twice. So only one
// refresh runs at a time, across tabs too (Web Locks), and each starts from the newest saved token.
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('rideflow-admin-refresh', fn) : fn()
}

let refreshInFlight: Promise<string | null> | null = null

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'idle',
      error: null,
      otpChallenge: null,

      login: async (email, password) => {
        set({ status: 'loading', error: null, otpChallenge: null })
        try {
          const { data } = await apiClient.post<LoginResult>('/auth/login', { email, password })
          if ('otpRequired' in data) {
            const { otpRequired: _omit, ...challenge } = data
            set({ status: 'unauthenticated', otpChallenge: challenge })
            return 'otp_required'
          }
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            status: 'authenticated',
            error: null,
          })
          return 'authenticated'
        } catch (err) {
          set({ status: 'unauthenticated', error: apiErrorMessage(err, 'Unable to sign in. Please try again.') })
          throw err
        }
      },

      verifyOtp: async (otp) => {
        const challenge = get().otpChallenge
        if (!challenge) throw new Error('No OTP challenge in progress')
        set({ error: null })
        try {
          const { data } = await apiClient.post<LoginResponse>('/auth/login/verify-otp', { otpToken: challenge.otpToken, otp })
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            status: 'authenticated',
            error: null,
            otpChallenge: null,
          })
        } catch (err) {
          const status = (err as { response?: { status?: number } }).response?.status
          // 401 means the challenge itself expired: send the admin back to the password step.
          set({
            error: apiErrorMessage(err, 'Could not verify the OTP. Please try again.'),
            ...(status === 401 ? { otpChallenge: null } : {}),
          })
          throw err
        }
      },

      resendOtp: async () => {
        const challenge = get().otpChallenge
        if (!challenge) return
        set({ error: null })
        try {
          const { data } = await apiClient.post<Omit<OtpChallenge, 'otpToken'>>('/auth/login/resend-otp', { otpToken: challenge.otpToken })
          set({ otpChallenge: { ...challenge, ...data } })
        } catch (err) {
          set({ error: apiErrorMessage(err, 'Could not resend the OTP.') })
          throw err
        }
      },

      cancelOtp: () => set({ otpChallenge: null, error: null }),

      logout: async () => {
        try {
          await apiClient.post('/auth/logout')
        } catch {
          // best-effort; clear local session regardless
        }
        get().clearSession()
      },

      bootstrap: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          set({ status: 'unauthenticated' })
          return
        }
        set({ status: 'loading' })
        // A server that is restarting (or a network blip) is retried instead of signing the admin out.
        for (let attempt = 1; ; attempt++) {
          try {
            const accessToken = await get().refreshAccessToken()
            if (!accessToken) {
              get().clearSession()
              return
            }
            const { data } = await apiClient.get<AuthUser>('/auth/me')
            set({ user: data, status: 'authenticated', error: null })
            return
          } catch (err) {
            if (isUnauthorized(err)) {
              get().clearSession()
              return
            }
            if (attempt >= 6) {
              // The saved session is kept, so a reload signs straight back in once the server is up.
              set({ status: 'unauthenticated', error: 'Could not reach the server. Please try again in a moment.' })
              return
            }
            await sleep(attempt * 1000)
          }
        }
      },

      refreshAccessToken: () => {
        refreshInFlight ??= withRefreshLock(async () => {
          // Another tab may have used (and replaced) the token this tab loaded, so read the saved one.
          const stored = storedRefreshToken()
          const refreshToken = stored === undefined ? get().refreshToken : stored
          if (!refreshToken) return null
          try {
            const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken })
            set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
            return data.accessToken
          } catch (err) {
            // Only a rejected token ends the session; network and server errors are thrown to the caller.
            if (isUnauthorized(err)) return null
            throw err
          }
        }).finally(() => {
          refreshInFlight = null
        })
        return refreshInFlight
      },

      clearSession: () => {
        set({ user: null, accessToken: null, refreshToken: null, status: 'unauthenticated', error: null, otpChallenge: null })
      },

      hasPermission: (permission) => {
        const { user } = get()
        return !!user?.permissions.includes(permission)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
)
