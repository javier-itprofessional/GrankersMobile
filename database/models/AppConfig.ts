import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class AppConfig extends Model {
  static table = 'app_config';

  @text('config_key') configKey!: string;
  @text('config_value') configValue!: string;
}
