import { apiRequest } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

export interface SyncStatus {
  server_time: string;
  pending_events: number;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function bootstrap(): Promise<BootstrapData> {
  return apiRequest<BootstrapData>('/api/v1/sync/bootstrap/', { method: 'POST' });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return apiRequest<SyncStatus>('/api/v1/sync/status/');
}
