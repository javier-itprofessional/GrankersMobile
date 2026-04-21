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

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'grankers',
  jsi: true,
});

export const database = new Database({
  adapter,
  modelClasses: [Round, RoundPlayer, HoleScore, PendingSync, AppConfig, Course, Route, Hole, ActionLog],
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
