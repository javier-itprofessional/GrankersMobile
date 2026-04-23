import { Model } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import type RoundPlayer from './RoundPlayer';
import type HoleScore from './HoleScore';

export default class Round extends Model {
  static table = 'rounds';
  static associations = {
    round_players: { type: 'has_many' as const, foreignKey: 'round_id' },
    hole_scores: { type: 'has_many' as const, foreignKey: 'round_id' },
  };

  @text('mode') mode!: string;
  @text('course_name') courseName!: string;
  @text('route_name') routeName!: string;
  @field('current_hole') currentHole!: number;
  @text('status') status!: string;
  @text('current_screen') currentScreen!: string | null;
  @text('scoring_mode') scoringMode!: string;
  @text('visible_player_ids') visiblePlayerIds!: string;   // JSON string[]
  @text('hole_pars') holePars!: string;                    // JSON number[]
  @text('hole_handicaps') holeHandicaps!: string;          // JSON number[]
  @field('finished_at') finishedAt!: number | null;
  @field('created_at') createdAt!: number;

  // Competition fields
  @text('group_code') groupCode!: string | null;
  @text('competition_name') competitionName!: string | null;
  @text('event_name') eventName!: string | null;
  @text('date') date!: string | null;
  @text('tour_event_id') tourEventId!: string | null;  // FK -> tour_events.external_id

  // Free-play fields
  @text('game_name') gameName!: string | null;
  @text('group_name') groupName!: string | null;
  @text('password') password!: string | null;

  @children('round_players') roundPlayers!: RoundPlayer[];
  @children('hole_scores') holeScores!: HoleScore[];

  get holeParsArray(): number[] {
    return JSON.parse(this.holePars || '[]');
  }

  get holeHandicapsArray(): number[] {
    return JSON.parse(this.holeHandicaps || '[]');
  }

  get visiblePlayerIdsArray(): string[] {
    return JSON.parse(this.visiblePlayerIds || '[]');
  }
}
