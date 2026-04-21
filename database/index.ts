import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import Round from './models/Round';
import RoundPlayer from './models/RoundPlayer';
import HoleScore from './models/HoleScore';
import PendingSync from './models/PendingSync';
import AppConfig from './models/AppConfig';
import Course from './models/Course';
import Route from './models/Route';
import Hole from './models/Hole';
import ActionLog from './models/ActionLog';
import TourEvent from './models/TourEvent';
import PlayerCache from './models/PlayerCache';
import LeaderboardCache from './models/LeaderboardCache';
import MediaAttachment from './models/MediaAttachment';
import RankingsCache from './models/RankingsCache';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'grankers',
  jsi: true,
});

export const database = new Database({
  adapter,
  modelClasses: [Round, RoundPlayer, HoleScore, PendingSync, AppConfig, Course, Route, Hole, ActionLog, TourEvent, PlayerCache, LeaderboardCache, MediaAttachment, RankingsCache],
});

export { default as Round } from './models/Round';
export { default as RoundPlayer } from './models/RoundPlayer';
export { default as HoleScore } from './models/HoleScore';
export { default as PendingSync } from './models/PendingSync';
export { default as AppConfig } from './models/AppConfig';
export { default as Course } from './models/Course';
export { default as Route } from './models/Route';
export { default as Hole } from './models/Hole';
export { default as ActionLog } from './models/ActionLog';
export { default as TourEvent } from './models/TourEvent';
export { default as PlayerCache } from './models/PlayerCache';
export { default as LeaderboardCache } from './models/LeaderboardCache';
export { default as MediaAttachment } from './models/MediaAttachment';
export { default as RankingsCache } from './models/RankingsCache';
