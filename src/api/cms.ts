import { apiClient } from './client'
import type { CmsPage, CmsSlug } from '@/types/marketing'

export async function fetchCmsPages(): Promise<CmsPage[]> {
  const { data } = await apiClient.get<CmsPage[]>('/cms')
  return data
}

export async function fetchCmsPage(slug: CmsSlug): Promise<CmsPage> {
  const { data } = await apiClient.get<CmsPage>(`/cms/${slug}`)
  return data
}

export async function updateCmsPage(slug: CmsSlug, patch: { title?: string; content?: string }): Promise<CmsPage> {
  const { data } = await apiClient.patch<CmsPage>(`/cms/${slug}`, patch)
  return data
}
