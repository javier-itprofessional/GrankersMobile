import { useState, useEffect, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AuthStorage } from '@/services/auth-storage';
import { logout as authLogout } from '@/services/auth';
import {
  getMyProfile, getDashboardStats, getUpcomingEvents, getMyLicenses,
  UserProfile, UserLicense, DashboardStats, UpcomingEvent,
} from '@/services/user-service';
import { ProfileCache } from '@/services/profile-cache';

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

// Fetch all player data from the API and persist to cache
async function fetchAndCache(): Promise<{
  profile: UserProfile;
  stats: DashboardStats;
  events: UpcomingEvent[];
  licenses: UserLicense[];
}> {
  const [profile, stats, events, licenses] = await Promise.all([
    getMyProfile(),
    getDashboardStats(),
    getUpcomingEvents(),
    getMyLicenses(),
  ]);

  await Promise.all([
    ProfileCache.setProfile(profile),
    ProfileCache.setStats(stats),
    ProfileCache.setEvents(events),
    ProfileCache.setLicenses(licenses),
    ProfileCache.touch(),
  ]);

  return { profile, stats, events, licenses };
}

export const [PlayerAuthContext, usePlayerAuth] = createContextHook(() => {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userLicenses, setUserLicenses] = useState<UserLicense[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Prevents double background-refresh when the effect fires twice in StrictMode
  const refreshing = useRef(false);

  const applyData = useCallback((data: {
    profile: UserProfile;
    stats: DashboardStats;
    events: UpcomingEvent[];
    licenses: UserLicense[];
  }) => {
    const fullName = `${data.profile.first_name} ${data.profile.last_name}`.trim();
    setUserProfile(data.profile);
    setUserLicenses(data.licenses);
    setDashboardStats(data.stats);
    setUpcomingEvents(data.events);
    if (fullName) {
      setSession((prev) => (prev ? { ...prev, name: fullName } : prev));
    }
  }, []);

  const loadSession = useCallback(async () => {
    const accessToken = await AuthStorage.getAccessToken();
    if (!accessToken) {
      setSession(null);
      return;
    }

    const parsed = sessionFromAccessToken(accessToken);
    setSession(parsed);
    if (!parsed) return;

    // 1. Load from cache immediately so UI renders without a spinner
    const [cachedProfile, cachedStats, cachedEvents, cachedLicenses] = await Promise.all([
      ProfileCache.getProfile(),
      ProfileCache.getStats(),
      ProfileCache.getEvents(),
      ProfileCache.getLicenses(),
    ]);

    const hasCachedData = cachedProfile && cachedStats && cachedEvents && cachedLicenses;
    if (hasCachedData) {
      applyData({
        profile: cachedProfile,
        stats: cachedStats,
        events: cachedEvents,
        licenses: cachedLicenses,
      });
    }

    // 2. Background refresh if cache is stale or missing
    const stale = await ProfileCache.isStale();
    if ((stale || !hasCachedData) && !refreshing.current) {
      refreshing.current = true;
      fetchAndCache()
        .then(applyData)
        .catch(() => {})
        .finally(() => { refreshing.current = false; });
    }
  }, [applyData]);

  useEffect(() => {
    loadSession().finally(() => setIsLoading(false));
  }, [loadSession]);

  // Called by login screens after tokens are stored — forces a fresh API fetch
  const reloadSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  // Force a fresh fetch from API (e.g. after profile edit)
  const reloadProfile = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const data = await fetchAndCache();
      applyData(data);
    } catch {
    } finally {
      refreshing.current = false;
    }
  }, [applyData]);

  // Optimistic local update for licenses after CRUD — avoids a full refetch
  const updateCachedLicenses = useCallback(async (licenses: UserLicense[]) => {
    setUserLicenses(licenses);
    await ProfileCache.setLicenses(licenses);
  }, []);

  const clearSession = useCallback(async () => {
    try {
      await authLogout();
    } catch {}
    finally {
      await ProfileCache.clear();
      setSession(null);
      setUserProfile(null);
      setUserLicenses([]);
      setDashboardStats(null);
      setUpcomingEvents([]);
    }
  }, []);

  const isAuthenticated = session !== null;

  return {
    session,
    userProfile,
    userLicenses,
    dashboardStats,
    upcomingEvents,
    isLoading,
    isAuthenticated,
    reloadSession,
    reloadProfile,
    updateCachedLicenses,
    clearSession,
  };
});
