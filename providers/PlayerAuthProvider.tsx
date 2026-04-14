import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AuthStorage } from '@/services/auth-storage';
import { logout as authLogout } from '@/services/auth';

export interface PlayerSession {
  id: string;
  name: string;
  email: string;
  country: string;
  authMethod: 'google' | 'email';
  createdAt: string;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function sessionFromAccessToken(token: string): PlayerSession | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Accept any non-expired token — try common Django JWT fields for user id
  const id = payload.user_id || payload.sub || payload.uuid || payload.id || '';

  const firstName = payload.first_name || '';
  const lastName = payload.last_name || '';
  const name = payload.name || `${firstName} ${lastName}`.trim() || payload.email || payload.username || '';

  // Minimal session — enough to mark user as authenticated
  return {
    id: id || 'authenticated',
    name,
    email: payload.email || '',
    country: payload.country || '',
    authMethod: 'email',
    createdAt: new Date().toISOString(),
  };
}

export const [PlayerAuthContext, usePlayerAuth] = createContextHook(() => {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSession = useCallback(async () => {
    try {
      const accessToken = await AuthStorage.getAccessToken();
      if (!accessToken) {
        setSession(null);
        return;
      }
      const parsed = sessionFromAccessToken(accessToken);
      setSession(parsed);
    } catch (error) {
      console.error('[PlayerAuth] Error loading session:', error);
      setSession(null);
    }
  }, []);

  useEffect(() => {
    loadSession().finally(() => setIsLoading(false));
  }, [loadSession]);

  // Called by login/register screens after auth service stores tokens
  const reloadSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const clearSession = useCallback(async () => {
    try {
      await authLogout();
    } catch (error) {
      console.error('[PlayerAuth] Error during logout:', error);
    } finally {
      setSession(null);
    }
  }, []);

  const isAuthenticated = session !== null;

  return {
    session,
    isLoading,
    isAuthenticated,
    reloadSession,
    clearSession,
  };
});
