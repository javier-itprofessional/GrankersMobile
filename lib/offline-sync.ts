import NetInfo from '@react-native-community/netinfo';
import { Q } from '@nozbe/watermelondb';
import { database, PendingSync, AppConfig } from '@/database';
import type { SyncEventType } from '@/database/models/PendingSync';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface PendingSyncItem {
  id: string;
  syncId: string;
  type: SyncEventType;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

// ─── Pending sync ──────────────────────────────────────────────────────────────

export const addPendingSync = async (
  type: SyncEventType,
  payload: Record<string, unknown>
): Promise<void> => {
  await database.write(async () => {
    await database.get<PendingSync>('pending_syncs').create((record) => {
      record.syncId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      record.type = type;
      record.payload = JSON.stringify(payload);
      record.timestamp = Date.now();
      record.retries = 0;
    });
  });
};

export const getPendingSync = async (): Promise<PendingSyncItem[]> => {
  const records = await database.get<PendingSync>('pending_syncs').query().fetch();
  return records.map((r) => ({
    id: r.id,
    syncId: r.syncId,
    type: r.type,
    payload: r.parsedPayload,
    timestamp: r.timestamp,
    retries: r.retries,
  }));
};

export const removePendingSync = async (id: string): Promise<void> => {
  await database.write(async () => {
    const record = await database.get<PendingSync>('pending_syncs').find(id);
    await record.destroyPermanently();
  });
};

export const incrementSyncRetries = async (id: string): Promise<void> => {
  await database.write(async () => {
    const record = await database.get<PendingSync>('pending_syncs').find(id);
    await record.update((r) => {
      r.retries = r.retries + 1;
    });
  });
};

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
