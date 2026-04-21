import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// prettier-ignore

export default schemaMigrations({
  migrations: [
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
    {
      toVersion: 2,
      steps: [
        // Añadir route_id a rounds
        addColumns({
          table: 'rounds',
          columns: [
            { name: 'route_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        // Nueva tabla: campos
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
        // Nueva tabla: recorridos
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
        // Nueva tabla: hoyos
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
