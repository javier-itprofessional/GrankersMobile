import { apiRequest } from './api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SessionPlayer {
  player_uuid: string;
  handicap_index: number;
  tee_color?: string;
}

interface CreateSessionRequest {
  course_uuid: string;
  mode: 'competition' | 'free-play';
  tee_color?: string;
  tour_event_uuid?: string;   // only when mode = 'competition'
  group_code?: string;
  players: SessionPlayer[];
}

export interface ScoringSession {
  uuid: string;              // = round_id en la app
  status: 'in_progress' | 'finished' | 'suspended';
  started_at: string;
  mode: 'competition' | 'free-play';
  tee_color?: string;
  holes: { hole_number: number; par: number; handicap: number; stroke_index: number }[];
  players: {
    player_uuid: string;
    playing_handicap: number;
    tee_color: string;
    status: string;
  }[];
  tour_event?: Record<string, unknown>;
  course?: { uuid: string; name: string };
}

// ─── Funciones ────────────────────────────────────────────────────────────────

// If offline, skip — ROUND_STARTED in the action_log will create the session on the server when synced.
export async function createScoringSession(params: CreateSessionRequest): Promise<ScoringSession> {
  return apiRequest<ScoringSession>('/api/1/scoring/session', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getScorecard(sessionUuid: string): Promise<unknown> {
  return apiRequest(`/api/1/scoring/session/${sessionUuid}/scorecard`);
}

export async function getLiveLeaderboard(eventUuid: string): Promise<unknown> {
  return apiRequest(`/api/1/scoring/leaderboard/${eventUuid}`);
}
