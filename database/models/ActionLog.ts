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
  strokes: number;           // golpes brutos (era "score")
  putts?: number;
  penalties?: number;
  fairway_hit?: boolean;
  gir?: boolean;             // green in regulation
}

export interface ScoreAmendedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;           // nueva puntuación corregida
  putts?: number;
  reason?: string;
}

export interface PenaltyAddedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  penalty_type: string;      // e.g. "ob", "hazard", "unplayable"
  strokes: number;           // golpes de penalización (era "penalty_strokes")
}

export interface PlayerReadyPayload {
  round_id: string;
  player_id: string;
}

export interface RoundStartedPayload {
  round_id: string;
  course_id?: string;
  tee_color?: string;
  mode: 'competition' | 'free-play';
  players?: { player_uuid: string; handicap_index: number; tee_color?: string }[];
}

export interface RoundFinishedPayload {
  round_id: string;
  total_strokes_by_player?: Record<string, number>;
}

export interface RoundSuspendedPayload {
  round_id: string;
  reason?: string;           // weather | injury | darkness
}

export interface RoundResumedPayload {
  round_id: string;
}

export interface ConcessionPayload {
  round_id: string;
  hole_number: number;
  conceder_player_id: string;  // jugador que concede (era "player_id")
}

export interface HoleResultPayload {
  round_id: string;
  hole_number: number;
  winner_player_id?: string;   // undefined = halved
}

export interface NoteAddedPayload {
  round_id: string;
  hole_number?: number;
  text: string;
  media_ref?: string;          // UUID v7 de un media_attachment asociado
}

export interface MediaAttachedPayload {
  round_id: string;
  media_ref: string;           // UUID v7 (era "attachment_id")
  caption?: string;
}

export interface SignatureAddedPayload {
  round_id: string;
  marker_player_id: string;    // jugador que firma (era "player_id")
  media_ref: string;           // UUID v7 (era "attachment_id")
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
