import { apiClient } from './client'
import type { Banner } from '@/types/marketing'

export async function fetchBanners(params?: { status?: string; serviceMode?: string }): Promise<Banner[]> {
  const { data } = await apiClient.get<Banner[]>('/banners', { params })
  return data
}

export async function createBanner(input: Partial<Banner>): Promise<Banner> {
  const { data } = await apiClient.post<Banner>('/banners', input)
  return data
}

export async function updateBanner(id: string, patch: Partial<Banner>): Promise<Banner> {
  const { data } = await apiClient.patch<Banner>(`/banners/${id}`, patch)
  return data
}

export async function deleteBanner(id: string): Promise<void> {
  await apiClient.delete(`/banners/${id}`)
}
