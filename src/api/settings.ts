import { apiClient } from './client'
import type { PlatformSettings } from '@/types/settings'

export async function fetchSettings(): Promise<PlatformSettings> {
  const { data } = await apiClient.get<PlatformSettings>('/settings')
  return data
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const { data } = await apiClient.patch<PlatformSettings>('/settings', patch)
  return data
}
