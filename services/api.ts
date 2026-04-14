import { AuthStorage } from './auth-storage';
import { getDeviceId } from './device';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await AuthStorage.getRefreshToken();
  const deviceId = await getDeviceId();
  if (!refreshToken) return false;

  const response = await fetch(`${API_URL}/auth/mobile/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) return false;

  const data = await response.json();
  await AuthStorage.setTokens(data.access, data.refresh);
  return true;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const deviceId = await getDeviceId();
  let accessToken = await AuthStorage.getAccessToken();

  if (accessToken && isTokenExpired(accessToken)) {
    const refreshed = await refreshTokens();
    if (!refreshed) throw new Error('SESSION_EXPIRED');
    accessToken = await AuthStorage.getAccessToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    const refreshed = await refreshTokens();
    if (!refreshed) throw new Error('SESSION_EXPIRED');
    accessToken = await AuthStorage.getAccessToken();
    headers['Authorization'] = `Bearer ${accessToken}`;
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
