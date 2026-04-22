import { apiRequest, apiRequestFormData } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UploadStatus = 'pending' | 'uploading' | 'synced' | 'failed';

export interface MediaUploadResult {
  attachment_id: string;
  url: string;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadMedia(
  attachmentId: string,
  roundId: string,
  fileUri: string,
  mimeType: string
): Promise<MediaUploadResult> {
  const formData = new FormData();
  formData.append('attachment_id', attachmentId);
  formData.append('round_id', roundId);
  formData.append('file', {
    uri: fileUri,
    type: mimeType,
    name: `${attachmentId}.${mimeType.split('/')[1] ?? 'jpg'}`,
  } as unknown as Blob);

  return apiRequestFormData<MediaUploadResult>('/api/v1/sync/media/', formData);
}

export async function registerPushToken(
  pushToken: string,
  platform: 'ios' | 'android'
): Promise<void> {
  await apiRequest<void>('/api/v1/sync/device/register/', {
    method: 'POST',
    body: JSON.stringify({ push_token: pushToken, platform }),
  });
}
