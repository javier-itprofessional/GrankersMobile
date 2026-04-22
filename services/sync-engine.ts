import { Q } from '@nozbe/watermelondb';
import { database, ActionLog } from '@/database';
import type { ActionType, ActionPayload } from '@/database/models/ActionLog';
import { apiRequest } from './api';
import { subscribeToConnectionChanges } from '@/lib/offline-sync';

const MAX_RETRIES = 5;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;   // flush periódico cada 30s

// ─── Tipos del protocolo ──────────────────────────────────────────────────────

interface SyncAction {
  id: string;
  action_type: ActionType;
  payload: ActionPayload;
  created_at: string;    // ISO 8601 — e.g. "2026-04-21T14:32:01.123Z"
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

// ─── SyncEngine ───────────────────────────────────────────────────────────────

class SyncEngine {
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeConnection: (() => void) | null = null;
  private isFlushing = false;
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
        created_at: new Date(a.createdAt).toISOString(),  // ISO 8601 per spec
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
          // Errores de validación no se reintentarán (reason prefix: invalid_payload, unauthorized, etc.)
          const isTransient = reason.startsWith('internal') || reason.startsWith('network');
          this.nextRetryAt.set(action.id, Date.now() + (isTransient ? delay : Number.MAX_SAFE_INTEGER));
          await action.update((r) => {
            r.retryCount = nextCount;
            r.lastError = reason;
          });
        }
      }
    });
  }

  // Iniciar flush periódico + escuchar reconexión
  start(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, FLUSH_INTERVAL_MS);

    this.unsubscribeConnection = subscribeToConnectionChanges((isConnected) => {
      if (isConnected) this.flush().catch(() => {});
    });
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
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
