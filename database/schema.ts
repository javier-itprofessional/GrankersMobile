import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 5,
  tables: [
    // ─── Rounds ───────────────────────────────────────────────────────────────
    tableSchema({
      name: 'rounds',
      columns: [
        { name: 'mode', type: 'string' },                                        // competition | free-play
        { name: 'course_name', type: 'string' },
        { name: 'route_name', type: 'string' },
        { name: 'route_id', type: 'string', isOptional: true, isIndexed: true }, // FK -> routes
        { name: 'tour_event_id', type: 'string', isOptional: true, isIndexed: true }, // FK -> tour_events
        { name: 'current_hole', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'current_screen', type: 'string', isOptional: true },
        { name: 'scoring_mode', type: 'string' },
        { name: 'visible_player_ids', type: 'string' },
        { name: 'hole_pars', type: 'string' },        // JSON number[] snapshot at round start
        { name: 'hole_handicaps', type: 'string' },   // JSON number[] snapshot at round start
        { name: 'finished_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'group_code', type: 'string', isOptional: true },
        { name: 'competition_name', type: 'string', isOptional: true },
        { name: 'event_name', type: 'string', isOptional: true },
        { name: 'date', type: 'string', isOptional: true },
        { name: 'game_name', type: 'string', isOptional: true },
        { name: 'group_name', type: 'string', isOptional: true },
        { name: 'password', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'round_players',
      columns: [
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'player_id', type: 'string', isOptional: true, isIndexed: true }, // FK -> players_cache
        { name: 'player_external_id', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'license', type: 'string', isOptional: true },
        { name: 'handicap', type: 'number', isOptional: true },
        { name: 'device_id', type: 'string', isOptional: true },
        { name: 'is_local_device', type: 'boolean' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'hole_scores',
      columns: [
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'player_external_id', type: 'string', isIndexed: true },
        { name: 'hole_number', type: 'number' },
        { name: 'par', type: 'number' },
        { name: 'handicap', type: 'number' },
        { name: 'score', type: 'number' },
        { name: 'strokes_net', type: 'number', isOptional: true },
        { name: 'saved', type: 'boolean' },
        { name: 'saved_at', type: 'number', isOptional: true },
        { name: 'conflict_score_local', type: 'number', isOptional: true },
        { name: 'conflict_score_marker', type: 'number', isOptional: true },
      ],
    }),
    // ─── Sync queue ───────────────────────────────────────────────────────────
    tableSchema({
      name: 'pending_syncs',
      columns: [
        { name: 'sync_id', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'timestamp', type: 'number' },
        { name: 'retries', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'app_config',
      columns: [
        { name: 'config_key', type: 'string', isIndexed: true },
        { name: 'config_value', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'action_log',
      columns: [
        { name: 'action_type', type: 'string' },
        { name: 'payload', type: 'string' },                         // JSON
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'retry_count', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
      ],
    }),
    // ─── Courses & routes ─────────────────────────────────────────────────────
    tableSchema({
      name: 'courses',
      columns: [
        { name: 'external_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'city', type: 'string', isOptional: true },
        { name: 'country', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'routes',
      columns: [
        { name: 'course_id', type: 'string', isIndexed: true },
        { name: 'course_external_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'num_holes', type: 'number' },
        { name: 'par_total', type: 'number' },
        { name: 'slope', type: 'number', isOptional: true },
        { name: 'course_rating', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'holes',
      columns: [
        { name: 'route_id', type: 'string', isIndexed: true },
        { name: 'hole_number', type: 'number' },
        { name: 'par', type: 'number' },
        { name: 'handicap', type: 'number' },
        { name: 'distance_meters', type: 'number', isOptional: true },
        { name: 'distance_yards', type: 'number', isOptional: true },
      ],
    }),
    // ─── Tour events cache ────────────────────────────────────────────────────
    tableSchema({
      name: 'tour_events',
      columns: [
        { name: 'external_id', type: 'string', isIndexed: true },
        { name: 'competition_name', type: 'string' },
        { name: 'event_name', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'tee_time', type: 'string', isOptional: true },
        { name: 'format', type: 'string', isOptional: true },       // stroke | stableford | matchplay
        { name: 'status', type: 'string' },                         // upcoming | active | finished
        { name: 'cut_rule', type: 'string', isOptional: true },     // JSON
        { name: 'fee_tiers', type: 'string', isOptional: true },    // JSON
        { name: 'tee_times', type: 'string', isOptional: true },    // JSON
        { name: 'group_code', type: 'string', isOptional: true, isIndexed: true },
        { name: 'course_name', type: 'string', isOptional: true },
        { name: 'route_name', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    // ─── Players cache ────────────────────────────────────────────────────────
    tableSchema({
      name: 'players_cache',
      columns: [
        { name: 'external_id', type: 'string', isIndexed: true },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'license', type: 'string', isOptional: true, isIndexed: true },
        { name: 'handicap_index', type: 'number', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    // ─── Leaderboard cache ────────────────────────────────────────────────────
    tableSchema({
      name: 'leaderboard_cache',
      columns: [
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },                         // JSON LeaderboardEntry[] snapshot
        { name: 'updated_at', type: 'number' },
        { name: 'source', type: 'string' },                          // websocket | local
      ],
    }),
    // ─── Media attachments ────────────────────────────────────────────────────
    tableSchema({
      name: 'media_attachments',
      columns: [
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'player_external_id', type: 'string', isOptional: true },
        { name: 'attachment_type', type: 'string' },                 // photo | signature | document
        { name: 'local_path', type: 'string' },
        { name: 'remote_url', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string' },                   // pending | uploading | synced | failed
        { name: 'action_log_id', type: 'string', isOptional: true }, // FK -> action_log
        { name: 'mime_type', type: 'string', isOptional: true },
        { name: 'file_size_bytes', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'last_error', type: 'string', isOptional: true },
      ],
    }),
    // ─── Rankings cache ───────────────────────────────────────────────────────
    tableSchema({
      name: 'rankings_cache',
      columns: [
        { name: 'player_external_id', type: 'string', isIndexed: true },
        { name: 'tour_event_id', type: 'string', isIndexed: true },
        { name: 'handicap_index', type: 'number' },
        { name: 'ranking_position', type: 'number', isOptional: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
  ],
});
