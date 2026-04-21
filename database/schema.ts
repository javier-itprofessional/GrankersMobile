import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'rounds',
      columns: [
        { name: 'mode', type: 'string' },
        { name: 'course_name', type: 'string' },
        { name: 'route_name', type: 'string' },
        { name: 'route_id', type: 'string', isOptional: true, isIndexed: true }, // FK -> routes
        { name: 'current_hole', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'current_screen', type: 'string', isOptional: true },
        { name: 'scoring_mode', type: 'string' },
        { name: 'visible_player_ids', type: 'string' },
        { name: 'hole_pars', type: 'string' },        // snapshot JSON number[] al inicio de la ronda
        { name: 'hole_handicaps', type: 'string' },   // snapshot JSON number[] al inicio de la ronda
        { name: 'finished_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'codigo_grupo', type: 'string', isOptional: true },
        { name: 'nombre_competicion', type: 'string', isOptional: true },
        { name: 'nombre_prueba', type: 'string', isOptional: true },
        { name: 'fecha', type: 'string', isOptional: true },
        { name: 'game_name', type: 'string', isOptional: true },
        { name: 'group_name', type: 'string', isOptional: true },
        { name: 'password', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'round_players',
      columns: [
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'player_external_id', type: 'string' },
        { name: 'nombre', type: 'string' },
        { name: 'apellido', type: 'string' },
        { name: 'licencia', type: 'string', isOptional: true },
        { name: 'handicap', type: 'number', isOptional: true },
        { name: 'device_id', type: 'string', isOptional: true },
        { name: 'is_local_device', type: 'boolean' },
        { name: 'estado', type: 'string' },
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
        { name: 'saved', type: 'boolean' },
        { name: 'saved_at', type: 'number', isOptional: true },
        { name: 'conflict_score_local', type: 'number', isOptional: true },
        { name: 'conflict_score_marcador', type: 'number', isOptional: true },
      ],
    }),
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
        { name: 'action_type', type: 'string' },                        // HOLE_SAVED | PLAYER_READY | ROUND_STARTED | ROUND_FINISHED
        { name: 'payload', type: 'string' },                            // JSON
        { name: 'round_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },        // null = pendiente
        { name: 'retry_count', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
      ],
    }),
    // ─── Campos y recorridos ──────────────────────────────────────────────────
    tableSchema({
      name: 'courses',
      columns: [
        { name: 'external_id', type: 'string', isIndexed: true }, // clave en Firebase
        { name: 'nombre', type: 'string' },
        { name: 'ciudad', type: 'string', isOptional: true },
        { name: 'pais', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'routes',
      columns: [
        { name: 'course_id', type: 'string', isIndexed: true },  // FK -> courses
        { name: 'course_external_id', type: 'string', isIndexed: true },
        { name: 'nombre', type: 'string' },
        { name: 'num_hoyos', type: 'number' },                   // 9 o 18
        { name: 'par_total', type: 'number' },                   // ej. 72
        { name: 'slope', type: 'number', isOptional: true },     // slope rating
        { name: 'course_rating', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'holes',
      columns: [
        { name: 'route_id', type: 'string', isIndexed: true },   // FK -> routes
        { name: 'hole_number', type: 'number' },                 // 1-18
        { name: 'par', type: 'number' },                         // 3, 4 o 5
        { name: 'handicap', type: 'number' },                    // índice slope 1-18
        { name: 'distancia_metros', type: 'number', isOptional: true },
        { name: 'distancia_yards', type: 'number', isOptional: true },
      ],
    }),
  ],
});
