import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import type Round from './Round';

export default class RoundPlayer extends Model {
  static table = 'round_players';
  static associations = {
    rounds: { type: 'belongs_to' as const, key: 'round_id' },
  };

  @text('round_id') roundId!: string;
  @text('player_external_id') playerExternalId!: string;
  @text('first_name') firstName!: string;
  @text('last_name') lastName!: string;
  @text('license') license!: string | null;
  @field('handicap') handicap!: number | null;
  @text('player_id') playerId!: string | null;          // FK -> players_cache.external_id
  @text('device_id') deviceId!: string | null;
  @field('is_local_device') isLocalDevice!: boolean;
  @text('status') status!: string;

  @relation('rounds', 'round_id') round!: Round;
}
