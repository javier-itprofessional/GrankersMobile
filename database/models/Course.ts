import { Model } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import type Route from './Route';

export default class Course extends Model {
  static table = 'courses';
  static associations = {
    routes: { type: 'has_many' as const, foreignKey: 'course_id' },
  };

  @text('external_id') externalId!: string;   // clave en Firebase ej. "Real Club de Golf"
  @text('nombre') nombre!: string;
  @text('ciudad') ciudad!: string | null;
  @text('pais') pais!: string | null;
  @field('synced_at') syncedAt!: number;

  @children('routes') routes!: Route[];
}
