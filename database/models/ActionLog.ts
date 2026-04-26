import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

// ─── Tipos de acción ──────────────────────────────────────────────────────────

export type ActionType =
  // Scoring
  | 'HOLE_SAVED'
  | 'SCORE_AMENDED'
  | 'PENALTY_ADDED'
  // Player / round
  | 'PLAYER_READY'
  | 'ROUND_STARTED'
  | 'ROUND_FINISHED'
  | 'ROUND_SUSPENDED'
  | 'ROUND_RESUMED'
  // Concessions / matchplay
  | 'CONCESSION'
  | 'HOLE_WON'
  | 'HOLE_HALVED'
  // Documentation
  | 'NOTE_ADDED'
  | 'MEDIA_ATTACHED'
  | 'SIGNATURE_ADDED';

// ─── Payloads tipados (spec v2.4.0) ──────────────────────────────────────────

export interface HoleSavedPayload {
  round_id: string;
  hole_number: number;
  scores: { player_id: string; score: number; strokes_net?: number }[];
}

export interface ScoreAmendedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  old_score: number;
  new_score: number;
  reason?: string;
}

export interface PenaltyAddedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  penalty_strokes: number;
  reason?: string;
}

export interface PlayerReadyPayload {
  round_id: string;
  player_id: string;
}

export interface RoundStartedPayload {
  round_id: string;
  mode: 'competition' | 'free-play';
  group_code?: string;
  tour_event_id?: string;
  course_name?: string;
  route_name?: string;
  tee_color?: string;
  hole_pars?: number[];
  hole_handicaps?: number[];
  players?: { player_id: string; first_name: string; last_name: string; handicap?: number; tee_color?: string }[];
}

export interface RoundFinishedPayload {
  round_id: string;
}

export interface RoundSuspendedPayload {
  round_id: string;
  reason?: string;
}

export interface RoundResumedPayload {
  round_id: string;
}

export interface ConcessionPayload {
  round_id: string;
  hole_number: number;
  conceding_player_id: string;
  beneficiary_player_id: string;
}

export interface HoleResultPayload {
  round_id: string;
  hole_number: number;
  winner_player_id?: string;
}

export interface NoteAddedPayload {
  round_id: string;
  hole_number?: number;
  text: string;
}

export interface MediaAttachedPayload {
  round_id: string;
  hole_number?: number;
  attachment_id: string;
  attachment_type: 'photo' | 'video' | 'signature';
}

export interface SignatureAddedPayload {
  round_id: string;
  attachment_id: string;
  signed_by_player_id: string;
}

export type ActionPayload =
  | HoleSavedPayload
  | ScoreAmendedPayload
  | PenaltyAddedPayload
  | PlayerReadyPayload
  | RoundStartedPayload
  | RoundFinishedPayload
  | RoundSuspendedPayload
  | RoundResumedPayload
  | ConcessionPayload
  | HoleResultPayload
  | NoteAddedPayload
  | MediaAttachedPayload
  | SignatureAddedPayload;

// ─── Modelo ───────────────────────────────────────────────────────────────────

export default class ActionLog extends Model {
  static table = 'action_log';

  @text('action_type') actionType!: ActionType;
  @text('payload') payload!: string;              // JSON serializado
  @text('round_id') roundId!: string;
  @field('created_at') createdAt!: number;
  @field('synced_at') syncedAt!: number | null;   // null = pendiente de sync
  @field('retry_count') retryCount!: number;
  @text('last_error') lastError!: string | null;

  get isPending(): boolean {
    return this.syncedAt === null;
  }

  get parsedPayload(): ActionPayload {
    return JSON.parse(this.payload);
  }
}
