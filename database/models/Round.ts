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
  @text('codigo_grupo') codigoGrupo!: string | null;
  @text('nombre_competicion') nombreCompeticion!: string | null;
  @text('nombre_prueba') nombrePrueba!: string | null;
  @text('fecha') fecha!: string | null;

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
