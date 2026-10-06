import { apiClient } from './client'
import type { Ticket } from '@/types/marketing'

export async function fetchTickets(params?: { category?: string; status?: string; priority?: string; q?: string }): Promise<Ticket[]> {
  const { data } = await apiClient.get<Ticket[]>('/tickets', { params })
  return data
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const { data } = await apiClient.get<Ticket>(`/tickets/${id}`)
  return data
}

export async function updateTicket(
  id: string,
  patch: Partial<{ status: string; priority: string; assignedTo: string | null; note: string }>,
): Promise<Ticket> {
  const { data } = await apiClient.patch<Ticket>(`/tickets/${id}`, patch)
  return data
}
