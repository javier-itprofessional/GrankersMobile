import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { LeaderboardEntry } from '@/services/websocket';

export type LeaderboardSource = 'websocket' | 'local';

export default class LeaderboardCache extends Model {
  static table = 'leaderboard_cache';

  @text('round_id') roundId!: string;
  @text('payload') payload!: string;          // JSON de LeaderboardEntry[]
  @field('updated_at') updatedAt!: number;
  @text('source') source!: LeaderboardSource;

  get entries(): LeaderboardEntry[] {
    return JSON.parse(this.payload || '[]');
  }
}
