import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class RankingsCache extends Model {
  static table = 'rankings_cache';

  @text('player_external_id') playerExternalId!: string;
  @text('tour_event_id') tourEventId!: string;          // FK -> tour_events.external_id
  @field('handicap_index') handicapIndex!: number;
  @field('ranking_position') rankingPosition!: number | null;
  @text('category') category!: string | null;           // categoría de la prueba
  @field('synced_at') syncedAt!: number;
}
