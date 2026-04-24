import { schemaMigrations, addColumns, createTable, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

// prettier-ignore

export default schemaMigrations({
  migrations: [
    // ─── v6: session_uuid on rounds; tee_color/gender/total_distance on routes ─
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'rounds',
          columns: [
            { name: 'session_uuid', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'routes',
          columns: [
            { name: 'tee_color', type: 'string', isOptional: true },
            { name: 'gender', type: 'string', isOptional: true },
            { name: 'total_distance', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // ─── v5: rename all Spanish column names to English ───────────────────────
    {
      toVersion: 5,
      steps: [
        // rounds
        unsafeExecuteSql('ALTER TABLE rounds RENAME COLUMN codigo_grupo TO group_code;'),
        unsafeExecuteSql('ALTER TABLE rounds RENAME COLUMN nombre_competicion TO competition_name;'),
        unsafeExecuteSql('ALTER TABLE rounds RENAME COLUMN nombre_prueba TO event_name;'),
        unsafeExecuteSql('ALTER TABLE rounds RENAME COLUMN fecha TO date;'),
        // round_players
        unsafeExecuteSql('ALTER TABLE round_players RENAME COLUMN nombre TO first_name;'),
        unsafeExecuteSql('ALTER TABLE round_players RENAME COLUMN apellido TO last_name;'),
        unsafeExecuteSql('ALTER TABLE round_players RENAME COLUMN licencia TO license;'),
        unsafeExecuteSql('ALTER TABLE round_players RENAME COLUMN estado TO status;'),
        // hole_scores
        unsafeExecuteSql('ALTER TABLE hole_scores RENAME COLUMN conflict_score_marcador TO conflict_score_marker;'),
        // courses
        unsafeExecuteSql('ALTER TABLE courses RENAME COLUMN nombre TO name;'),
        unsafeExecuteSql('ALTER TABLE courses RENAME COLUMN ciudad TO city;'),
        unsafeExecuteSql('ALTER TABLE courses RENAME COLUMN pais TO country;'),
        // routes
        unsafeExecuteSql('ALTER TABLE routes RENAME COLUMN nombre TO name;'),
        unsafeExecuteSql('ALTER TABLE routes RENAME COLUMN num_hoyos TO num_holes;'),
        // holes
        unsafeExecuteSql('ALTER TABLE holes RENAME COLUMN distancia_metros TO distance_meters;'),
        unsafeExecuteSql('ALTER TABLE holes RENAME COLUMN distancia_yards TO distance_yards;'),
        // tour_events
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN nombre_competicion TO competition_name;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN nombre_prueba TO event_name;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN fecha TO date;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN hora_salida TO tee_time;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN formato TO format;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN codigo_grupo TO group_code;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN campo TO course_name;'),
        unsafeExecuteSql('ALTER TABLE tour_events RENAME COLUMN recorrido TO route_name;'),
        // players_cache
        unsafeExecuteSql('ALTER TABLE players_cache RENAME COLUMN nombre TO first_name;'),
        unsafeExecuteSql('ALTER TABLE players_cache RENAME COLUMN apellido TO last_name;'),
        unsafeExecuteSql('ALTER TABLE players_cache RENAME COLUMN licencia TO license;'),
      ],
    },
    // ─── v4: competition/player/leaderboard/media/rankings cache tables ───────
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'rounds',
          columns: [
            { name: 'tour_event_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'round_players',
          columns: [
            { name: 'player_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'hole_scores',
          columns: [
            { name: 'strokes_net', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'tour_events',
          columns: [
            { name: 'external_id', type: 'string', isIndexed: true },
            { name: 'nombre_competicion', type: 'string' },
            { name: 'nombre_prueba', type: 'string' },
            { name: 'fecha', type: 'string' },
            { name: 'hora_salida', type: 'string', isOptional: true },
            { name: 'formato', type: 'string', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'cut_rule', type: 'string', isOptional: true },
            { name: 'fee_tiers', type: 'string', isOptional: true },
            { name: 'tee_times', type: 'string', isOptional: true },
            { name: 'codigo_grupo', type: 'string', isOptional: true, isIndexed: true },
            { name: 'campo', type: 'string', isOptional: true },
            { name: 'recorrido', type: 'string', isOptional: true },
            { name: 'synced_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'players_cache',
          columns: [
            { name: 'external_id', type: 'string', isIndexed: true },
            { name: 'nombre', type: 'string' },
            { name: 'apellido', type: 'string' },
            { name: 'licencia', type: 'string', isOptional: true, isIndexed: true },
            { name: 'handicap_index', type: 'number', isOptional: true },
            { name: 'avatar_url', type: 'string', isOptional: true },
            { name: 'synced_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'leaderboard_cache',
          columns: [
            { name: 'round_id', type: 'string', isIndexed: true },
            { name: 'payload', type: 'string' },
            { name: 'updated_at', type: 'number' },
            { name: 'source', type: 'string' },
          ],
        }),
        createTable({
          name: 'media_attachments',
          columns: [
            { name: 'round_id', type: 'string', isIndexed: true },
            { name: 'player_external_id', type: 'string', isOptional: true },
            { name: 'attachment_type', type: 'string' },
            { name: 'local_path', type: 'string' },
            { name: 'remote_url', type: 'string', isOptional: true },
            { name: 'upload_status', type: 'string' },
            { name: 'action_log_id', type: 'string', isOptional: true },
            { name: 'mime_type', type: 'string', isOptional: true },
            { name: 'file_size_bytes', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'last_error', type: 'string', isOptional: true },
          ],
        }),
        createTable({
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
    },
    // ─── v3: action_log ───────────────────────────────────────────────────────
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'action_log',
          columns: [
            { name: 'action_type', type: 'string' },
            { name: 'payload', type: 'string' },
            { name: 'round_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'retry_count', type: 'number' },
            { name: 'last_error', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // ─── v2: courses / routes / holes ─────────────────────────────────────────
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'rounds',
          columns: [
            { name: 'route_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        createTable({
          name: 'courses',
          columns: [
            { name: 'external_id', type: 'string', isIndexed: true },
            { name: 'nombre', type: 'string' },
            { name: 'ciudad', type: 'string', isOptional: true },
            { name: 'pais', type: 'string', isOptional: true },
            { name: 'synced_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'routes',
          columns: [
            { name: 'course_id', type: 'string', isIndexed: true },
            { name: 'course_external_id', type: 'string', isIndexed: true },
            { name: 'nombre', type: 'string' },
            { name: 'num_hoyos', type: 'number' },
            { name: 'par_total', type: 'number' },
            { name: 'slope', type: 'number', isOptional: true },
            { name: 'course_rating', type: 'number', isOptional: true },
            { name: 'synced_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'holes',
          columns: [
            { name: 'route_id', type: 'string', isIndexed: true },
            { name: 'hole_number', type: 'number' },
            { name: 'par', type: 'number' },
            { name: 'handicap', type: 'number' },
            { name: 'distancia_metros', type: 'number', isOptional: true },
            { name: 'distancia_yards', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
