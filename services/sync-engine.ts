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
  created_at: number;
}

interface SyncRequest {
  actions: SyncAction[];
}

interface SyncResponse {
  synced: string[];           // IDs de acciones aceptadas
  failed: { id: string; error: string }[];
}

// ─── SyncEngine ───────────────────────────────────────────────────────────────

class SyncEngine {
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeConnection: (() => void) | null = null;
  private isFlushing = false;

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
      const pending = await database
        .get<ActionLog>('action_log')
        .query(
          Q.and(
            Q.where('synced_at', Q.eq(null)),
            Q.where('retry_count', Q.lt(MAX_RETRIES))
          )
        )
        .fetch();

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
      // Error de red o auth: incrementar reintentos en todos
      await database.write(async () => {
        for (const action of actions) {
          await action.update((r) => {
            r.retryCount = r.retryCount + 1;
            r.lastError = error instanceof Error ? error.message : 'network_error';
          });
        }
      });
      return;
    }

    // Marcar las aceptadas como sincronizadas
    const syncedIds = new Set(response.synced);
    const failedMap = new Map(response.failed.map((f) => [f.id, f.error]));

    await database.write(async () => {
      for (const action of actions) {
        if (syncedIds.has(action.id)) {
          await action.update((r) => {
            r.syncedAt = Date.now();
          });
        } else if (failedMap.has(action.id)) {
          await action.update((r) => {
            r.retryCount = r.retryCount + 1;
            r.lastError = failedMap.get(action.id) ?? 'unknown';
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
