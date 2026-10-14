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

    // Concurrent 401s share one refresh (see refreshAccessToken). If the refresh itself fails on the network,
    // that error is thrown and the admin stays signed in.
    const newToken = await useAuthStore.getState().refreshAccessToken()
    if (!newToken) {
      useAuthStore.getState().clearSession()
      throw error
    }

    originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
    return apiClient(originalRequest)
  },
)
