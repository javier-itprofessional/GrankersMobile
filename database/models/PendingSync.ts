import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type SyncEventType =
  | 'hole_score'
  | 'competition_result'
  | 'player_status_changed';

export default class PendingSync extends Model {
  static table = 'pending_syncs';

  @text('sync_id') syncId!: string;
  @text('type') type!: SyncEventType;
  @text('payload') payload!: string;   // JSON serializado
  @field('timestamp') timestamp!: number;
  @field('retries') retries!: number;

  get parsedPayload(): Record<string, unknown> {
    return JSON.parse(this.payload || '{}');
  }
}
