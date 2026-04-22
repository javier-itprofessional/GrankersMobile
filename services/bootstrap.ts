import { apiRequest } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type BootstrapScope = 'player_profile' | 'active_tournaments' | 'upcoming_rounds';

export interface BootstrapData {
  timestamp: string;
  data: {
    user?: Record<string, unknown>;
    memberships?: unknown[];
    tournaments?: unknown[];
    events?: unknown[];
    courses?: unknown[];
    registrations?: unknown[];
    playing_partners?: unknown[];
    rankings?: unknown[];
    leaderboards?: unknown[];
  };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

/**
 * Descarga inicial de datos del backend.
 * Llamar en: primer login, tras un período largo offline, tras nueva inscripción.
 *
 * Popula las tablas locales: courses, routes, holes, tour_events, players_cache,
 * rankings_cache, leaderboard_cache.
 */
export async function bootstrap(scopes?: BootstrapScope[]): Promise<BootstrapData> {
  return apiRequest<BootstrapData>('/api/1/sync/bootstrap', {
    method: 'POST',
    body: JSON.stringify(scopes ? { scopes } : {}),
  });
}

/**
 * Comprueba el estado de sync del servidor.
 * Útil para detección de drift de reloj y pendientes server-side.
 */
export interface SyncStatus {
  server_time: string;
  pending_events: number;
  last_sync_at: string | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return apiRequest<SyncStatus>('/api/v1/sync/status');
}
