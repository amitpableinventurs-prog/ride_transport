import { apiClient } from './client'
import type { NotificationTemplate, NotificationBroadcast } from '@/types/marketing'

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const { data } = await apiClient.get<NotificationTemplate[]>('/notifications/templates')
  return data
}

export async function createNotificationTemplate(input: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
  const { data } = await apiClient.post<NotificationTemplate>('/notifications/templates', input)
  return data
}

export async function updateNotificationTemplate(id: string, patch: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
  const { data } = await apiClient.patch<NotificationTemplate>(`/notifications/templates/${id}`, patch)
  return data
}

export async function fetchBroadcasts(): Promise<NotificationBroadcast[]> {
  const { data } = await apiClient.get<NotificationBroadcast[]>('/notifications/broadcasts')
  return data
}

export async function sendBroadcast(input: {
  templateId?: string | null
  channel: string
  audience: string
  serviceModeFilter: string
  title: string
  body: string
}): Promise<NotificationBroadcast> {
  const { data } = await apiClient.post<NotificationBroadcast>('/notifications/broadcasts', input)
  return data
}
