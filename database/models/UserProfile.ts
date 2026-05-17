import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class UserProfile extends Model {
  static table = 'user_profile';

  @text('external_id') externalId!: string;
  @text('first_name') firstName!: string;
  @text('last_name') lastName!: string;
  @text('email') email!: string;
  @text('phone') phone!: string | null;
  @field('handicap_index') handicapIndex!: number | null;
  @text('avatar_url') avatarUrl!: string | null;
  @text('home_club_id') homeClubId!: string | null;
  @text('license_number') licenseNumber!: string | null;
  @field('synced_at') syncedAt!: number;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
