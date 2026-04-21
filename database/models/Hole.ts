import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import type Route from './Route';

export default class Hole extends Model {
  static table = 'holes';
  static associations = {
    routes: { type: 'belongs_to' as const, key: 'route_id' },
  };

  @text('route_id') routeId!: string;
  @field('hole_number') holeNumber!: number;       // 1-18
  @field('par') par!: number;                      // 3, 4 o 5
  @field('handicap') handicap!: number;            // índice slope 1-18
  @field('distancia_metros') distanciaMetros!: number | null;
  @field('distancia_yards') distanciaYards!: number | null;

  @relation('routes', 'route_id') route!: Route;
}
