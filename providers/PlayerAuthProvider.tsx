import { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AuthStorage } from '@/services/auth-storage';
import { logout as authLogout } from '@/services/auth';
import { getMyProfile, UserProfile } from '@/services/user-service';

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

  const id = payload.user_id || payload.sub || payload.uuid || payload.id || '';
  const firstName = payload.first_name || '';
  const lastName = payload.last_name || '';
  const name = payload.name || `${firstName} ${lastName}`.trim() || payload.email || payload.username || '';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSession = useCallback(async () => {
    try {
      const accessToken = await AuthStorage.getAccessToken();
      if (!accessToken) {
        setSession(null);
        setUserProfile(null);
        return;
      }
      const parsed = sessionFromAccessToken(accessToken);
      setSession(parsed);
      if (parsed) {
        try {
          const profile = await getMyProfile();
          setUserProfile(profile);
          // Enrich session name from full profile
          const fullName = `${profile.first_name} ${profile.last_name}`.trim();
          if (fullName) {
            setSession((prev) => prev ? { ...prev, name: fullName } : prev);
          }
        } catch {
          // Profile fetch failing doesn't invalidate the session
        }
      }
    } catch (error) {
      console.error('[PlayerAuth] Error loading session:', error);
      setSession(null);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    loadSession().finally(() => setIsLoading(false));
  }, [loadSession]);

  const reloadSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const reloadProfile = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setUserProfile(profile);
      const fullName = `${profile.first_name} ${profile.last_name}`.trim();
      if (fullName) {
        setSession((prev) => prev ? { ...prev, name: fullName } : prev);
      }
    } catch {
      // Ignore — stale profile is better than crash
    }
  }, []);

  const clearSession = useCallback(async () => {
    try {
      await authLogout();
    } catch (error) {
      console.error('[PlayerAuth] Error during logout:', error);
    } finally {
      setSession(null);
      setUserProfile(null);
    }
  }, []);

  const isAuthenticated = session !== null;

  return {
    session,
    userProfile,
    isLoading,
    isAuthenticated,
    reloadSession,
    reloadProfile,
    clearSession,
  };
});
