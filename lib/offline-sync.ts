import NetInfo from '@react-native-community/netinfo';
import { Q } from '@nozbe/watermelondb';
import { database, AppConfig } from '@/database';

// ─── App config (device ID, etc.) ─────────────────────────────────────────────

const getConfig = async (key: string): Promise<string | null> => {
  const records = await database
    .get<AppConfig>('app_config')
    .query(Q.where('config_key', key))
    .fetch();
  return records[0]?.configValue ?? null;
};

const setConfig = async (key: string, value: string): Promise<void> => {
  await database.write(async () => {
    const existing = await database
      .get<AppConfig>('app_config')
      .query(Q.where('config_key', key))
      .fetch();

    if (existing.length > 0) {
      await existing[0].update((r) => {
        r.configValue = value;
      });
    } else {
      await database.get<AppConfig>('app_config').create((r) => {
        r.configKey = key;
        r.configValue = value;
      });
    }
  });
};

export const generateDeviceId = async (): Promise<string> => {
  let deviceId = await getConfig('device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    await setConfig('device_id', deviceId);
  }
  return deviceId;
};

export const getDeviceId = async (): Promise<string | null> => {
  return getConfig('device_id');
};

export const getAppConfig = async (key: string): Promise<string | null> => {
  return getConfig(key);
};

export const setAppConfig = async (key: string, value: string): Promise<void> => {
  return setConfig(key, value);
};

export const removeAppConfig = async (key: string): Promise<void> => {
  await database.write(async () => {
    const records = await database
      .get<AppConfig>('app_config')
      .query(Q.where('config_key', key))
      .fetch();
    for (const r of records) {
      await r.destroyPermanently();
    }
  });
};

// ─── Conexión ─────────────────────────────────────────────────────────────────

export const checkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
};

export const subscribeToConnectionChanges = (
  callback: (isConnected: boolean) => void
): (() => void) => {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected === true && state.isInternetReachable === true);
  });
};
