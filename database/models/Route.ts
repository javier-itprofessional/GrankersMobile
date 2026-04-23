import { Model } from '@nozbe/watermelondb';
import { field, text, children, relation } from '@nozbe/watermelondb/decorators';
import type Course from './Course';
import type Hole from './Hole';

export default class Route extends Model {
  static table = 'routes';
  static associations = {
    courses: { type: 'belongs_to' as const, key: 'course_id' },
    holes: { type: 'has_many' as const, foreignKey: 'route_id' },
  };

  @text('course_id') courseId!: string;
  @text('course_external_id') courseExternalId!: string;
  @text('name') name!: string;
  @field('num_holes') numHoles!: number;
  @field('par_total') parTotal!: number;
  @field('slope') slope!: number | null;
  @field('course_rating') courseRating!: number | null;
  @field('synced_at') syncedAt!: number;

  @relation('courses', 'course_id') course!: Course;
  @children('holes') holes!: Hole[];
}
