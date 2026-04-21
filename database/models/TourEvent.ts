import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type TourEventStatus = 'upcoming' | 'active' | 'finished';
export type TourEventFormat = 'stroke' | 'stableford' | 'matchplay' | 'greensomes' | 'fourball';

export default class TourEvent extends Model {
  static table = 'tour_events';

  @text('external_id') externalId!: string;
  @text('nombre_competicion') nombreCompeticion!: string;
  @text('nombre_prueba') nombrePrueba!: string;
  @text('fecha') fecha!: string;
  @text('hora_salida') horaSalida!: string | null;
  @text('formato') formato!: TourEventFormat | null;
  @text('status') status!: TourEventStatus;
  @text('cut_rule') cutRule!: string | null;      // JSON
  @text('fee_tiers') feeTiers!: string | null;    // JSON
  @text('tee_times') teeTimes!: string | null;    // JSON [{player_id, tee_time, hole_start}]
  @text('codigo_grupo') codigoGrupo!: string | null;
  @text('campo') campo!: string | null;
  @text('recorrido') recorrido!: string | null;
  @field('synced_at') syncedAt!: number;

  get teeTimesArray(): { player_id: string; tee_time: string; hole_start: number }[] {
    return JSON.parse(this.teeTimes || '[]');
  }

  get feeTiersData(): { category: string; fee: number }[] {
    return JSON.parse(this.feeTiers || '[]');
  }
}
