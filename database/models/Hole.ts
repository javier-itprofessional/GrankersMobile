import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import type Route from './Route';

export default class Hole extends Model {
  static table = 'holes';
  static associations = {
    routes: { type: 'belongs_to' as const, key: 'route_id' },
  };

  @text('route_id') routeId!: string;
  @field('hole_number') holeNumber!: number;
  @field('par') par!: number;
  @field('handicap') handicap!: number;
  @field('distance_meters') distanceMeters!: number | null;
  @field('distance_yards') distanceYards!: number | null;
  @field('elevation') elevation!: number | null;
  @field('fairway_width') fairwayWidth!: number | null;
  @field('fairway_length') fairwayLength!: number | null;
  @field('fairway_slope') fairwaySlope!: number | null;
  @field('fairway_slope_percentage') fairwaySlopePercentage!: number | null;

  @relation('routes', 'route_id') route!: Route;
}
