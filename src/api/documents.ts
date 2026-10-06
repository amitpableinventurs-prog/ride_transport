import { apiClient } from './client'
import type { DocumentOwnerType, DocumentRecord, DocumentStatus, PaginatedResult } from '@/types/entities'

export async function fetchDocuments(params: {
  page?: number
  limit?: number
  ownerType?: DocumentOwnerType
  status?: DocumentStatus
} = {}): Promise<PaginatedResult<DocumentRecord>> {
  const { data } = await apiClient.get<PaginatedResult<DocumentRecord>>('/fleet/documents', { params })
  return data
}

export async function updateDocumentStatus(
  id: string,
  patch: { status: 'verified' | 'rejected'; rejectionReason?: string },
): Promise<DocumentRecord> {
  const { data } = await apiClient.patch<DocumentRecord>(`/fleet/documents/${id}`, patch)
  return data
}
