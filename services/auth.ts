import { AuthStorage } from './auth-storage';
import { apiRequest } from './api';
import { getDeviceId } from './device';

// Safe import — GoogleSignin is a native module not available in Expo Go
let GoogleSignin: any = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch {
  // Running in Expo Go or web — Google Sign-In unavailable
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function configureGoogleSignIn(): void {
  if (!GoogleSignin) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
}

export async function loginWithGoogle(): Promise<{ uuid: string }> {
  if (!GoogleSignin) throw new Error('Google Sign-In requiere un development build (no disponible en Expo Go)');
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;
  if (!idToken) throw new Error('No se pudo obtener el token de Google');

  const deviceId = await getDeviceId();
  const response = await fetch(`${API_URL}/auth/mobile/google/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error al iniciar sesión con Google');
  }

  const data = await response.json();
  await AuthStorage.setTokens(data.access, data.refresh);
  return data.user;
}

export async function requestMagicLink(email: string): Promise<void> {
  const deviceId = await getDeviceId();
  const response = await fetch(`${API_URL}/auth/mobile/magic-link/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error al enviar el enlace');
  }
}

export async function verifyMagicLink(token: string): Promise<{ uuid: string }> {
  const deviceId = await getDeviceId();
  const response = await fetch(`${API_URL}/auth/mobile/magic-link/verify/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) throw new Error('Enlace inválido o expirado');

  const data = await response.json();
  await AuthStorage.setTokens(data.access, data.refresh);
  return data.user;
}

export async function register(params: {
  email: string;
  first_name: string;
  last_name: string;
  country: string;
}): Promise<void> {
  const deviceId = await getDeviceId();
  const response = await fetch(`${API_URL}/auth/mobile/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error al registrarse');
  }
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = await AuthStorage.getRefreshToken();
    if (refreshToken) {
      await apiRequest('/auth/mobile/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }
  } finally {
    await AuthStorage.clear();
  }
}
