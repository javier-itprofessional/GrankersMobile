import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// prettier-ignore

export default schemaMigrations({
  migrations: [
    // ─── v4: caché de competiciones, jugadores, leaderboard, adjuntos, rankings ─
    {
      toVersion: 4,
      steps: [
        // Nuevas columnas en tablas existentes
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
        // Nuevas tablas
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
