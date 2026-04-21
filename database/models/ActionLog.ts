import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

// ─── Tipos de acción ──────────────────────────────────────────────────────────

export type ActionType =
  // Puntuación
  | 'HOLE_SAVED'
  | 'SCORE_AMENDED'
  | 'PENALTY_ADDED'
  // Jugador / ronda
  | 'PLAYER_READY'
  | 'ROUND_STARTED'
  | 'ROUND_FINISHED'
  | 'ROUND_SUSPENDED'
  | 'ROUND_RESUMED'
  // Concesiones / matchplay
  | 'CONCESSION'
  | 'HOLE_WON'
  | 'HOLE_HALVED'
  // Documentación
  | 'NOTE_ADDED'
  | 'MEDIA_ATTACHED'
  | 'SIGNATURE_ADDED';

// ─── Payloads tipados ─────────────────────────────────────────────────────────

export interface HoleSavedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  score: number;
  par: number;
  handicap: number;
  strokes_net?: number;
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
  rule_reference?: string;  // e.g. "Rule 17.1"
}

export interface PlayerReadyPayload {
  round_id: string;
  player_id: string;
}

export interface RoundStartedPayload {
  round_id: string;
  competition_id?: string;
  tour_event_id?: string;
  mode: 'competition' | 'free-play';
}

export interface RoundFinishedPayload {
  round_id: string;
}

export interface RoundSuspendedPayload {
  round_id: string;
  reason?: string;          // weather | injury | darkness
}

export interface RoundResumedPayload {
  round_id: string;
}

export interface ConcessionPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
}

export interface HoleResultPayload {
  round_id: string;
  hole_number: number;
  winner_player_id?: string; // null = halved
}

export interface NoteAddedPayload {
  round_id: string;
  player_id?: string;
  hole_number?: number;
  text: string;
}

export interface MediaAttachedPayload {
  round_id: string;
  player_id?: string;
  attachment_id: string;    // FK -> media_attachments
  attachment_type: 'photo' | 'signature' | 'document';
}

export interface SignatureAddedPayload {
  round_id: string;
  player_id: string;        // jugador que firma
  signed_for_player_id: string; // jugador cuya tarjeta se firma (marker firma la tarjeta del jugador)
  attachment_id: string;    // FK -> media_attachments
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
