import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ClubCache extends Model {
  static table = 'clubs_cache';

  @text('external_id') externalId!: string;
  @text('name') name!: string;
  @text('city') city!: string | null;
  @text('country') country!: string | null;
  @text('address') address!: string | null;
  @text('phone') phone!: string | null;
  @text('website') website!: string | null;
  @text('logo_url') logoUrl!: string | null;
  @field('synced_at') syncedAt!: number;
}
