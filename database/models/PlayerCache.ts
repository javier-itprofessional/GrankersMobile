import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class PlayerCache extends Model {
  static table = 'players_cache';

  @text('external_id') externalId!: string;
  @text('nombre') nombre!: string;
  @text('apellido') apellido!: string;
  @text('licencia') licencia!: string | null;
  @field('handicap_index') handicapIndex!: number | null;
  @text('avatar_url') avatarUrl!: string | null;
  @field('synced_at') syncedAt!: number;

  get fullName(): string {
    return `${this.nombre} ${this.apellido}`;
  }
}
