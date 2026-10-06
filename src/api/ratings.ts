import { apiClient } from './client'
import type { Rating } from '@/types/marketing'

export async function fetchRatings(params?: { ratedBy?: string; minScore?: number }): Promise<Rating[]> {
  const { data } = await apiClient.get<Rating[]>('/ratings', { params })
  return data
}
