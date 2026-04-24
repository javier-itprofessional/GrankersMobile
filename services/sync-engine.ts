import { AppState } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database, ActionLog, TourEvent, PlayerCache } from '@/database';
import type { ActionType, ActionPayload } from '@/database/models/ActionLog';
import { apiRequest } from './api';
import { subscribeToConnectionChanges, getAppConfig, setAppConfig } from '@/lib/offline-sync';

const MAX_RETRIES = 5;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;   // flush periódico cada 30s
const BOOTSTRAP_MAX_AGE_MS = 24 * 60 * 60 * 1_000;  // 24h

// ─── Tipos del protocolo ──────────────────────────────────────────────────────

interface SyncAction {
  id: string;
  action_type: ActionType;
  payload: ActionPayload;
  created_at: number;    // Unix ms
}

interface SyncRequest {
  actions: SyncAction[];
}

interface SyncResponse {
  synced: string[];           // IDs de acciones aceptadas
  failed: { id: string; reason: string }[];  // "reason" per spec
}

// Backoff por número de reintentos: immediate, 5s, 30s, 2m, 10m
const RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000, 600_000];
const PULL_INTERVAL_MS = 5 * 60 * 1_000;  // 5 minutes

// ─── Pull types ───────────────────────────────────────────────────────────────

interface WirePullResponse {
  tour_events?: Array<{
    id: string;
    competition_name: string;
    event_name: string;
    date: string;
    tee_time?: string;
    format?: string;
    status: string;
    group_code?: string;
    course_name?: string;
    route_name?: string;
  }>;
  players_cache?: Array<{
    external_id: string;
    first_name: string;
    last_name: string;
    license?: string;
    handicap_index?: number;
    avatar_url?: string | null;
  }>;
  server_time_ms: number;
}

// Razones de error que el backend nunca resolverá — no reintentar
const NON_RETRIABLE_PREFIXES = new Set(['invalid_payload', 'unauthorized', 'not_found', 'session_locked']);

// ─── SyncEngine ───────────────────────────────────────────────────────────────

class SyncEngine {
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastAppState: string = AppState.currentState ?? 'active';
  private unsubscribeConnection: (() => void) | null = null;
  private isFlushing = false;
  private isPulling = false;
  // nextRetryAt[id] = timestamp ms a partir del cual se puede reintentar
  private nextRetryAt = new Map<string, number>();

  // Registrar una acción en el Action Log y disparar flush
  async record(type: ActionType, payload: ActionPayload, roundId: string): Promise<void> {
    await database.write(async () => {
      await database.get<ActionLog>('action_log').create((r) => {
        r.actionType = type;
        r.payload = JSON.stringify(payload);
        r.roundId = roundId;
        r.createdAt = Date.now();
        r.syncedAt = null;
        r.retryCount = 0;
        r.lastError = null;
      });
    });

    // Intentar flush inmediato (no bloquea)
    this.flush().catch(() => {});
  }

  // Enviar todas las acciones pendientes al backend en batch
  async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const candidates = await database
        .get<ActionLog>('action_log')
        .query(
          Q.and(
            Q.where('synced_at', Q.eq(null)),
            Q.where('retry_count', Q.lt(MAX_RETRIES))
          )
        )
        .fetch();

      const now = Date.now();
      const pending = candidates.filter(
        (a) => (this.nextRetryAt.get(a.id) ?? 0) <= now
      );

      if (pending.length === 0) return;

      // Enviar en batches de BATCH_SIZE
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        await this.sendBatch(batch);
      }
    } catch {
      // Fallo de red — se reintentará en el siguiente flush
    } finally {
      this.isFlushing = false;
    }
  }

  private async sendBatch(actions: ActionLog[]): Promise<void> {
    const body: SyncRequest = {
      actions: actions.map((a) => ({
        id: a.id,
        action_type: a.actionType,
        payload: a.parsedPayload,
        created_at: a.createdAt,
      })),
    };

    let response: SyncResponse;
    try {
      response = await apiRequest<SyncResponse>('/api/v1/sync/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      // Error de red o auth: incrementar reintentos en todos + programar backoff
      const now = Date.now();
      await database.write(async () => {
        for (const action of actions) {
          const nextCount = action.retryCount + 1;
          const delay = RETRY_DELAYS_MS[Math.min(nextCount, RETRY_DELAYS_MS.length - 1)];
          this.nextRetryAt.set(action.id, now + delay);
          await action.update((r) => {
            r.retryCount = nextCount;
            r.lastError = error instanceof Error ? error.message : 'network_error';
          });
        }
      });
      return;
    }

    // Marcar las aceptadas como sincronizadas
    const syncedIds = new Set(response.synced);
    const failedMap = new Map(response.failed.map((f) => [f.id, f.reason]));

    await database.write(async () => {
      for (const action of actions) {
        if (syncedIds.has(action.id)) {
          await action.update((r) => {
            r.syncedAt = Date.now();
          });
        } else if (failedMap.has(action.id)) {
          const reason = failedMap.get(action.id) ?? 'unknown';
          const nextCount = action.retryCount + 1;
          const delay = RETRY_DELAYS_MS[Math.min(nextCount, RETRY_DELAYS_MS.length - 1)];
          const isTransient = ![...NON_RETRIABLE_PREFIXES].some((p) => reason.startsWith(p));
          this.nextRetryAt.set(action.id, Date.now() + (isTransient ? delay : Number.MAX_SAFE_INTEGER));
          await action.update((r) => {
            r.retryCount = nextCount;
            r.lastError = reason;
          });
        }
      }
    });
  }

  // ─── Bootstrap (cold start / ≥24h inactivity) ────────────────────────────

  async bootstrap(): Promise<void> {
    try {
      const lastBootstrap = parseInt(await getAppConfig('last_bootstrap_ms') ?? '0', 10);
      if (Date.now() - lastBootstrap < BOOTSTRAP_MAX_AGE_MS) return;
      await apiRequest('/api/v1/sync/bootstrap/', { method: 'POST' });
      await setAppConfig('last_bootstrap_ms', String(Date.now()));
    } catch {
      // silently fail — will retry next foreground
    }
  }

  // ─── Sync pull incremental ────────────────────────────────────────────────

  async pull(): Promise<void> {
    if (this.isPulling) return;
    this.isPulling = true;
    try {
      const since = parseInt(await getAppConfig('last_pull_ms') ?? '0', 10);
      const url = since > 0
        ? `/api/v1/sync/pull/?since=${since}`
        : '/api/v1/sync/pull/';
      const data = await apiRequest<WirePullResponse>(url);

      await database.write(async () => {
        for (const p of data.players_cache ?? []) {
          const existing = await database.get<PlayerCache>('players_cache')
            .query(Q.where('external_id', p.external_id)).fetch();
          if (existing.length > 0) {
            await existing[0].update((r) => {
              r.firstName = p.first_name;
              r.lastName = p.last_name;
              r.license = p.license ?? null;
              r.handicapIndex = p.handicap_index ?? null;
              r.avatarUrl = p.avatar_url ?? null;
              r.syncedAt = Date.now();
            });
          } else {
            await database.get<PlayerCache>('players_cache').create((r) => {
              r.externalId = p.external_id;
              r.firstName = p.first_name;
              r.lastName = p.last_name;
              r.license = p.license ?? null;
              r.handicapIndex = p.handicap_index ?? null;
              r.avatarUrl = p.avatar_url ?? null;
              r.syncedAt = Date.now();
            });
          }
        }

        for (const e of data.tour_events ?? []) {
          const existing = await database.get<TourEvent>('tour_events')
            .query(Q.where('external_id', e.id)).fetch();
          if (existing.length > 0) {
            await existing[0].update((r) => {
              r.competitionName = e.competition_name;
              r.eventName = e.event_name;
              r.date = e.date;
              r.teeTime = e.tee_time ?? null;
              r.format = (e.format as TourEvent['format']) ?? null;
              r.status = e.status as TourEvent['status'];
              r.groupCode = e.group_code ?? null;
              r.courseName = e.course_name ?? null;
              r.routeName = e.route_name ?? null;
              r.syncedAt = Date.now();
            });
          } else {
            await database.get<TourEvent>('tour_events').create((r) => {
              r.externalId = e.id;
              r.competitionName = e.competition_name;
              r.eventName = e.event_name;
              r.date = e.date;
              r.teeTime = e.tee_time ?? null;
              r.format = (e.format as TourEvent['format']) ?? null;
              r.status = e.status as TourEvent['status'];
              r.groupCode = e.group_code ?? null;
              r.courseName = e.course_name ?? null;
              r.routeName = e.route_name ?? null;
              r.syncedAt = Date.now();
            });
          }
        }
      });

      await setAppConfig('last_pull_ms', String(data.server_time_ms));
    } catch {
      // Network error — will retry on next interval
    } finally {
      this.isPulling = false;
    }
  }

  // ─── Iniciar flush periódico + pull + reconexión ──────────────────────────

  start(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, FLUSH_INTERVAL_MS);

    this.pullTimer = setInterval(() => {
      this.pull().catch(() => {});
    }, PULL_INTERVAL_MS);

    this.pull().catch(() => {});
    this.bootstrap().catch(() => {});

    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (this.lastAppState !== 'active' && nextState === 'active') {
        this.pull().catch(() => {});
        this.bootstrap().catch(() => {});
      }
      this.lastAppState = nextState;
    });

    this.unsubscribeConnection = subscribeToConnectionChanges((isConnected) => {
      if (isConnected) this.flush().catch(() => {});
    });
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.unsubscribeConnection?.();
    this.unsubscribeConnection = null;
  }

  // Número de acciones pendientes (para UI de estado de sync)
  async pendingCount(): Promise<number> {
    const records = await database
      .get<ActionLog>('action_log')
      .query(Q.where('synced_at', Q.eq(null)))
      .fetch();
    return records.length;
  }
}

export const syncEngine = new SyncEngine();
