import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type TourEventStatus = 'upcoming' | 'active' | 'finished';
export type TourEventFormat = 'stroke' | 'stableford' | 'matchplay' | 'greensomes' | 'fourball';

export default class TourEvent extends Model {
  static table = 'tour_events';

  @text('external_id') externalId!: string;
  @text('competition_name') competitionName!: string;
  @text('event_name') eventName!: string;
  @text('date') date!: string;
  @text('tee_time') teeTime!: string | null;
  @text('format') format!: TourEventFormat | null;
  @text('status') status!: TourEventStatus;
  @text('cut_rule') cutRule!: string | null;      // JSON
  @text('fee_tiers') feeTiers!: string | null;    // JSON
  @text('tee_times') teeTimes!: string | null;    // JSON [{player_id, tee_time, hole_start}]
  @text('group_code') groupCode!: string | null;
  @text('course_name') courseName!: string | null;
  @text('route_name') routeName!: string | null;
  @field('synced_at') syncedAt!: number;

  get teeTimesArray(): { player_id: string; tee_time: string; hole_start: number }[] {
    return JSON.parse(this.teeTimes || '[]');
  }

  get feeTiersData(): { category: string; fee: number }[] {
    return JSON.parse(this.feeTiers || '[]');
  }
}
