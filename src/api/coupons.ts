import { apiClient } from './client'
import type { Coupon } from '@/types/marketing'

export async function fetchCoupons(params?: { autoApply?: boolean; status?: string; q?: string }): Promise<Coupon[]> {
  const { data } = await apiClient.get<Coupon[]>('/coupons', {
    params: {
      autoApply: params?.autoApply === undefined ? undefined : String(params.autoApply),
      status: params?.status,
      q: params?.q,
    },
  })
  return data
}

export async function createCoupon(input: Partial<Coupon>): Promise<Coupon> {
  const { data } = await apiClient.post<Coupon>('/coupons', input)
  return data
}

export async function updateCoupon(id: string, patch: Partial<Coupon>): Promise<Coupon> {
  const { data } = await apiClient.patch<Coupon>(`/coupons/${id}`, patch)
  return data
}

export async function deleteCoupon(id: string): Promise<void> {
  await apiClient.delete(`/coupons/${id}`)
}
