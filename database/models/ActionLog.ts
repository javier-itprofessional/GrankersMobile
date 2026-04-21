import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type ActionType =
  | 'HOLE_SAVED'
  | 'PLAYER_READY'
  | 'ROUND_STARTED'
  | 'ROUND_FINISHED';

export interface HoleSavedPayload {
  round_id: string;
  player_id: string;
  hole_number: number;
  score: number;
  par: number;
  handicap: number;
}

export interface PlayerReadyPayload {
  round_id: string;
  player_id: string;
}

export interface RoundStartedPayload {
  round_id: string;
  competition_id?: string;
  mode: 'competition' | 'free-play';
}

export interface RoundFinishedPayload {
  round_id: string;
}

export type ActionPayload =
  | HoleSavedPayload
  | PlayerReadyPayload
  | RoundStartedPayload
  | RoundFinishedPayload;

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
