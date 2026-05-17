import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserLicense, DashboardStats, UpcomingEvent } from './user-service';

const KEYS = {
  profile: 'player_profile',
  licenses: 'player_licenses',
  stats: 'player_stats',
  events: 'player_events',
  fetchedAt: 'player_data_fetched_at',
} as const;

// Background refresh if data is older than 5 minutes
const STALE_MS = 5 * 60 * 1000;

async function get<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const ProfileCache = {
  getProfile: () => get<UserProfile>(KEYS.profile),
  setProfile: (v: UserProfile) => set(KEYS.profile, v),

  getLicenses: () => get<UserLicense[]>(KEYS.licenses),
  setLicenses: (v: UserLicense[]) => set(KEYS.licenses, v),

  getStats: () => get<DashboardStats>(KEYS.stats),
  setStats: (v: DashboardStats) => set(KEYS.stats, v),

  getEvents: () => get<UpcomingEvent[]>(KEYS.events),
  setEvents: (v: UpcomingEvent[]) => set(KEYS.events, v),

  async isStale(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(KEYS.fetchedAt);
    if (!raw) return true;
    return Date.now() - Number(raw) > STALE_MS;
  },

  async touch(): Promise<void> {
    await AsyncStorage.setItem(KEYS.fetchedAt, String(Date.now()));
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
