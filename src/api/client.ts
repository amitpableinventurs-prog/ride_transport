import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1/admin',
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    // Sign-in endpoints return 401 for bad credentials/expired OTP sessions: never try a token refresh for those.
    const isAuthEndpoint = originalRequest?.url === '/auth/refresh' || originalRequest?.url?.startsWith('/auth/login')
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      throw error
    }

    originalRequest._retry = true

    if (!refreshPromise) {
      refreshPromise = useAuthStore
        .getState()
        .refreshAccessToken()
        .finally(() => {
          refreshPromise = null
        })
    }

    const newToken = await refreshPromise
    if (!newToken) {
      useAuthStore.getState().clearSession()
      throw error
    }

    originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
    return apiClient(originalRequest)
  },
)
