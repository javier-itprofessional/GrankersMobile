import { Model } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import type Route from './Route';

export default class Course extends Model {
  static table = 'courses';
  static associations = {
    routes: { type: 'has_many' as const, foreignKey: 'course_id' },
  };

  @text('external_id') externalId!: string;
  @text('name') name!: string;
  @text('city') city!: string | null;
  @text('country') country!: string | null;
  @field('synced_at') syncedAt!: number;

  @children('routes') routes!: Route[];
}
