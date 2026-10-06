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

function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

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
        const accessToken = await get().refreshAccessToken()
        if (!accessToken) {
          get().clearSession()
          return
        }
        try {
          const { data } = await apiClient.get<AuthUser>('/auth/me')
          set({ user: data, accessToken, status: 'authenticated' })
        } catch {
          get().clearSession()
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return null
        try {
          const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken })
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
          return data.accessToken
        } catch {
          return null
        }
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
      name: 'rideflow-admin-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
)
