# Grankers Mobile — Data Model v4

> WatermelonDB (SQLite local) · Schema versión 4 · 2026-04-21

---

## Resumen de tablas

| Tabla | Descripción | Estado |
|-------|-------------|--------|
| `rounds` | Ronda de juego (competición o free-play) | Core |
| `round_players` | Jugadores participantes en una ronda | Core |
| `hole_scores` | Puntuaciones por hoyo y jugador | Core |
| `action_log` | Event store — todas las acciones del juego | Core |
| `tour_events` | Caché de pruebas del tour sincronizadas desde backend | **Nuevo v4** |
| `players_cache` | Caché de jugadores del tour | **Nuevo v4** |
| `leaderboard_cache` | Leaderboard en tiempo real (WebSocket + local) | **Nuevo v4** |
| `media_attachments` | Fotos, documentos y firmas digitales | **Nuevo v4** |
| `rankings_cache` | Posiciones del ranking por jugador y prueba | **Nuevo v4** |
| `courses` | Catálogo de campos de golf | Existente |
| `routes` | Recorridos de un campo | Existente |
| `holes` | Hoyos de un recorrido | Existente |
| `app_config` | Configuración local clave-valor (incluye FCM token) | Existente |

---

## Core

### `rounds`

Representa una ronda de juego, ya sea una competición oficial o una partida libre.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `mode` | text | No | `competition` \| `free-play` |
| `course_name` | text | No | Nombre del campo |
| `route_name` | text | No | Nombre del recorrido |
| `current_hole` | number | No | Hoyo actual de la ronda |
| `status` | text | No | Estado de la ronda |
| `scoring_mode` | text | No | Modo de puntuación |
| `current_screen` | text | Sí | Pantalla activa en el dispositivo |
| `visible_player_ids` | text | No | JSON `string[]` — IDs de jugadores visibles |
| `hole_pars` | text | No | JSON `number[]` — par por hoyo |
| `hole_handicaps` | text | No | JSON `number[]` — handicap por hoyo |
| `finished_at` | number | Sí | Timestamp de fin de ronda |
| `created_at` | number | No | Timestamp de creación |
| `codigo_grupo` | text | Sí | Código de grupo (competición) |
| `nombre_competicion` | text | Sí | Nombre de la competición |
| `nombre_prueba` | text | Sí | Nombre de la prueba |
| `fecha` | text | Sí | Fecha de la prueba |
| `tour_event_id` | text | Sí | **[v4]** FK → `tour_events.external_id` (indexed) |
| `game_name` | text | Sí | Nombre de partida (free-play) |
| `group_name` | text | Sí | Nombre de grupo (free-play) |
| `password` | text | Sí | Contraseña de grupo (free-play) |

**Relaciones:** `has_many round_players`, `has_many hole_scores`

---

### `round_players`

Jugadores asignados a una ronda concreta.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `round_id` | text | No | FK → `rounds.id` (indexed) |
| `player_external_id` | text | No | ID externo del jugador (del backend) |
| `player_id` | text | Sí | **[v4]** FK → `players_cache.external_id` (indexed) |
| `nombre` | text | No | Nombre del jugador |
| `apellido` | text | No | Apellido del jugador |
| `licencia` | text | Sí | Número de licencia federativa |
| `handicap` | number | Sí | Handicap en el momento de la ronda |
| `device_id` | text | Sí | ID del dispositivo del jugador |
| `is_local_device` | boolean | No | Si es el dispositivo actual |
| `estado` | text | No | Estado del jugador en la ronda |

---

### `hole_scores`

Puntuaciones individuales por hoyo y jugador.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `round_id` | text | No | FK → `rounds.id` (indexed) |
| `player_external_id` | text | No | ID externo del jugador |
| `hole_number` | number | No | Número de hoyo (1–18) |
| `par` | number | No | Par del hoyo |
| `handicap` | number | No | Handicap del hoyo |
| `score` | number | No | Golpes brutos |
| `strokes_net` | number | Sí | **[v4]** Golpes netos (handicap aplicado) |
| `saved` | boolean | No | Si la puntuación ha sido guardada/confirmada |
| `saved_at` | number | Sí | Timestamp de confirmación |
| `conflict_score_local` | number | Sí | Puntuación local en caso de conflicto |
| `conflict_score_marcador` | number | Sí | Puntuación del marcador en caso de conflicto |

---

### `action_log`

**Event store central.** Todas las acciones del juego se registran aquí antes de sincronizarse con el backend. Es la fuente de verdad para la sincronización offline.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `round_id` | text | No | Ronda a la que pertenece la acción |
| `player_external_id` | text | No | Jugador que ejecuta la acción |
| `action_type` | text | No | Tipo de acción (ver enum abajo) |
| `payload` | text | No | JSON con los datos de la acción (ver interfaces) |
| `created_at` | number | No | Timestamp local de creación |
| `synced_at` | number | Sí | Timestamp de sincronización con backend |
| `sync_status` | text | No | `pending` \| `syncing` \| `synced` \| `failed` |
| `retry_count` | number | No | Número de reintentos de sincronización |
| `last_error` | text | Sí | Último error de sincronización |

#### `action_type` enum

| Valor | Categoría | Descripción |
|-------|-----------|-------------|
| `HOLE_SAVED` | Scoring | Puntuación de hoyo guardada |
| `SCORE_AMENDED` | Scoring | Corrección de puntuación |
| `PENALTY_ADDED` | Scoring | Penalización añadida (event-only, sin tabla separada) |
| `NOTE_ADDED` | Scoring | Nota de texto añadida |
| `PLAYER_READY` | Estado | Jugador listo para comenzar |
| `ROUND_STARTED` | Estado | Inicio de ronda |
| `ROUND_FINISHED` | Estado | Fin de ronda |
| `ROUND_SUSPENDED` | Estado | Ronda suspendida |
| `ROUND_RESUMED` | Estado | Ronda reanudada |
| `CONCESSION` | Matchplay | Concesión de hoyo |
| `HOLE_WON` | Matchplay | Hoyo ganado |
| `HOLE_HALVED` | Matchplay | Hoyo empatado |
| `MEDIA_ATTACHED` | Media | Adjunto multimedia añadido |
| `SIGNATURE_ADDED` | Media | Firma digital añadida |

#### Payload interfaces por `action_type`

```typescript
// HOLE_SAVED
{ hole_number: number; scores: { player_id: string; score: number; strokes_net?: number }[] }

// SCORE_AMENDED
{ hole_number: number; player_id: string; old_score: number; new_score: number; reason?: string }

// PENALTY_ADDED
{ hole_number: number; player_id: string; penalty_strokes: number; reason: string }

// PLAYER_READY
{ player_id: string }

// ROUND_STARTED / ROUND_FINISHED
{ round_id: string; mode: string }

// ROUND_SUSPENDED / ROUND_RESUMED
{ reason?: string }

// CONCESSION
{ hole_number: number; conceding_player_id: string; beneficiary_player_id: string }

// HOLE_WON / HOLE_HALVED
{ hole_number: number; winner_player_id?: string }

// NOTE_ADDED
{ hole_number?: number; text: string }

// MEDIA_ATTACHED
{ attachment_id: string; attachment_type: 'photo' | 'document'; hole_number?: number }

// SIGNATURE_ADDED
{ attachment_id: string; signed_by_player_id: string }
```

---

## Nuevas tablas — Schema v4

### `tour_events`

Caché local de las pruebas del tour, sincronizadas desde el backend. Permite acceso offline a la información de competición.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `external_id` | text | No | ID externo del backend (indexed) |
| `nombre_competicion` | text | No | Nombre de la competición |
| `nombre_prueba` | text | No | Nombre de la prueba |
| `fecha` | text | No | Fecha de la prueba (ISO string) |
| `hora_salida` | text | Sí | Hora de salida |
| `formato` | text | Sí | `stroke` \| `stableford` \| `matchplay` \| `greensomes` \| `fourball` |
| `status` | text | No | `upcoming` \| `active` \| `finished` |
| `cut_rule` | text | Sí | JSON — regla de corte |
| `fee_tiers` | text | Sí | JSON `{ category: string; fee: number }[]` |
| `tee_times` | text | Sí | JSON `{ player_id: string; tee_time: string; hole_start: number }[]` |
| `codigo_grupo` | text | Sí | Código de grupo de salida |
| `campo` | text | Sí | Nombre del campo |
| `recorrido` | text | Sí | Nombre del recorrido |
| `synced_at` | number | No | Timestamp de última sincronización |

---

### `players_cache`

Caché de jugadores del tour para resolución offline de nombres, hándicaps y avatares.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `external_id` | text | No | ID externo del backend (indexed) |
| `nombre` | text | No | Nombre |
| `apellido` | text | No | Apellido |
| `licencia` | text | Sí | Número de licencia federativa |
| `handicap_index` | number | Sí | Handicap index actual |
| `avatar_url` | text | Sí | URL del avatar |
| `synced_at` | number | No | Timestamp de última sincronización |

---

### `leaderboard_cache`

Almacena la última versión conocida del leaderboard por ronda. Se actualiza vía WebSocket; si no hay conexión, se sirve el dato local.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `round_id` | text | No | ID de la ronda (indexed) |
| `payload` | text | No | JSON `LeaderboardEntry[]` — array completo del leaderboard |
| `updated_at` | number | No | Timestamp de última actualización |
| `source` | text | No | `websocket` \| `local` |

> El campo `payload` contiene el leaderboard completo serializado. La app lo deserializa con el getter `entries`.

---

### `media_attachments`

Pipeline independiente de subida para fotos, documentos y firmas digitales. No pasa por `action_log` para la subida del binario, aunque sí se registra un evento en `action_log` (`MEDIA_ATTACHED` / `SIGNATURE_ADDED`).

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `round_id` | text | No | Ronda a la que pertenece |
| `player_external_id` | text | Sí | Jugador al que pertenece |
| `attachment_type` | text | No | `photo` \| `signature` \| `document` |
| `local_path` | text | No | Ruta local del archivo (`file://...`) |
| `remote_url` | text | Sí | URL remota tras subida exitosa |
| `upload_status` | text | No | `pending` \| `uploading` \| `synced` \| `failed` |
| `action_log_id` | text | Sí | Referencia al evento en `action_log` |
| `mime_type` | text | Sí | MIME type del archivo |
| `file_size_bytes` | number | Sí | Tamaño del archivo en bytes |
| `created_at` | number | No | Timestamp de creación local |
| `synced_at` | number | Sí | Timestamp de subida exitosa |
| `last_error` | text | Sí | Último error de subida |

**Estado de subida:**
```
pending → uploading → synced
                   └→ failed (reintentable)
```

> **Firmas:** se usan como `attachment_type = 'signature'`. No existe tabla separada para firmas.

---

### `rankings_cache`

Posiciones del ranking del tour por jugador y prueba.

| Campo | Tipo | Nullable | Descripción |
|-------|------|----------|-------------|
| `id` | text | — | PK generada por WatermelonDB |
| `player_external_id` | text | No | ID externo del jugador (indexed) |
| `tour_event_id` | text | No | Referencia a `tour_events.external_id` |
| `handicap_index` | number | No | Handicap index en el momento del ranking |
| `ranking_position` | number | Sí | Posición en el ranking (null si no clasificado) |
| `category` | text | Sí | Categoría de la prueba |
| `synced_at` | number | No | Timestamp de última sincronización |

---

## Catálogo de campos

### `courses`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK WatermelonDB |
| `external_id` | text | ID externo del backend |
| `name` | text | Nombre del campo |
| `synced_at` | number | Timestamp de sincronización |

### `routes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK WatermelonDB |
| `course_id` | text | FK → `courses.id` |
| `external_id` | text | ID externo del backend |
| `name` | text | Nombre del recorrido |
| `synced_at` | number | Timestamp de sincronización |

### `holes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK WatermelonDB |
| `route_id` | text | FK → `routes.id` |
| `hole_number` | number | Número de hoyo (1–18) |
| `par` | number | Par del hoyo |
| `handicap` | number | Handicap del hoyo |
| `distance_meters` | number? | Distancia en metros |

---

## Infraestructura

### `app_config`

Almacén clave-valor de configuración local. Incluye el token FCM (no existe tabla separada para `device_registration`).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK WatermelonDB |
| `key` | text | Clave única (e.g. `fcm_token`, `user_id`, `last_sync`) |
| `value` | text | Valor serializado |
| `updated_at` | number | Timestamp de última actualización |

---

## Flujo de sincronización

```
┌─────────────────────────────────────────────────────────────┐
│  Scoring / Events                                           │
│                                                             │
│  User Action → action_log → SyncEngine → POST /api/v1/sync/│
│                             (batch, retry, backoff)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Attachments (pipeline independiente)                       │
│                                                             │
│  Capture → media_attachments (pending)                      │
│          → UploadPipeline → CDN / S3                        │
│          → media_attachments (synced) + remote_url          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Live data (WebSocket)                                      │
│                                                             │
│  ws:// → leaderboard_cache                                  │
│        → round_players.estado                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Backend sync (pull)                                        │
│                                                             │
│  GET /api/... → tour_events                                 │
│              → players_cache                                │
│              → rankings_cache                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisiones de diseño

| Decisión | Alternativa descartada | Razón |
|----------|------------------------|-------|
| Penalties como evento en `action_log` | Tabla `penalties` separada | No necesitan ciclo de vida propio; el payload de `PENALTY_ADDED` contiene toda la información necesaria |
| Firmas como `media_attachments` con `type='signature'` | Tabla `signatures` separada | Mismo pipeline de subida que fotos/docs; el tipo distingue suficientemente |
| FCM token en `app_config` | Tabla `device_registration` | Es un único valor por dispositivo; key-value es suficiente y evita una tabla con una sola fila |
| `leaderboard_cache` con payload JSON completo | Filas individuales por entrada | El leaderboard se recibe y actualiza como array completo desde WebSocket; almacenarlo como blob es más eficiente |

---

## Notas para el backend

- **`action_log` → `/api/v1/sync/`**: la app envía lotes de acciones pendientes. El backend debe ser idempotente por `id` de acción.
- **`tour_events.external_id`**: debe coincidir con el identificador que el backend usa en sus respuestas de pruebas.
- **`players_cache.external_id`**: debe coincidir con el `player_id` que se usa en `round_players.player_external_id` y en los payloads de `action_log`.
- **`media_attachments`**: la subida de binarios es independiente del flujo de `action_log`. El backend recibirá primero el evento (`MEDIA_ATTACHED` / `SIGNATURE_ADDED`) con el `attachment_id`, y posteriormente el binario desde el pipeline de media.
- **WebSocket**: la app espera eventos `player_status_changed` y `leaderboard_updated` en el canal de la ronda.
