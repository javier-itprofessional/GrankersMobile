import { AuthStorage } from './auth-storage';
import { getDeviceId } from './device';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UploadStatus = 'pending' | 'uploading' | 'synced' | 'failed';

export interface MediaUploadResult {
  media_ref: string;          // mismo UUID que se envió
  server_file_uuid: string;   // UUID asignado por el backend
  url: string;                // URL pública en CDN
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Sube un archivo multimedia al backend.
 *
 * Flujo:
 * 1. El evento (MEDIA_ATTACHED / SIGNATURE_ADDED) ya llegó al backend vía action_log
 *    con el media_ref como referencia.
 * 2. Esta función sube el binario. El backend los vincula por media_ref.
 *
 * @param mediaRef  UUID v7 que identifica el adjunto (debe coincidir con el evento)
 * @param roundId   UUID de la sesión de juego
 * @param fileUri   Ruta local del archivo (file://)
 * @param mimeType  MIME type: image/jpeg | image/png | image/heic
 */
export async function uploadMedia(
  mediaRef: string,
  roundId: string,
  fileUri: string,
  mimeType: string
): Promise<MediaUploadResult> {
  const token = await AuthStorage.getAccessToken();
  const deviceId = await getDeviceId();

  const formData = new FormData();
  formData.append('media_ref', mediaRef);
  formData.append('round_id', roundId);
  formData.append('file', {
    uri: fileUri,
    type: mimeType,
    name: `${mediaRef}.${mimeType.split('/')[1] ?? 'jpg'}`,
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/api/1/sync/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'X-Device-ID': deviceId,
      // No poner Content-Type — fetch lo setea automáticamente con el boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`media_upload_failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<MediaUploadResult>;
}

/**
 * Registra el token FCM/APNs en el backend para notificaciones push.
 * Llamar tras obtener el token de Firebase Messaging o APNs.
 */
export async function registerPushToken(
  pushToken: string,
  platform: 'ios' | 'android'
): Promise<void> {
  const token = await AuthStorage.getAccessToken();
  const deviceId = await getDeviceId();

  await fetch(`${API_URL}/api/1/sync/device/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'X-Device-ID': deviceId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ push_token: pushToken, platform }),
  });
}
