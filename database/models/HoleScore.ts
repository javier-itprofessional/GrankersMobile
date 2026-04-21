import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import type Round from './Round';

export default class HoleScore extends Model {
  static table = 'hole_scores';
  static associations = {
    rounds: { type: 'belongs_to' as const, key: 'round_id' },
  };

  @text('round_id') roundId!: string;
  @text('player_external_id') playerExternalId!: string;
  @field('hole_number') holeNumber!: number;
  @field('par') par!: number;
  @field('handicap') handicap!: number;
  @field('score') score!: number;
  @field('saved') saved!: boolean;
  @field('saved_at') savedAt!: number | null;
  @field('strokes_net') strokesNet!: number | null;
  @field('conflict_score_local') conflictScoreLocal!: number | null;
  @field('conflict_score_marcador') conflictScoreMarcador!: number | null;

  @relation('rounds', 'round_id') round!: Round;
}
