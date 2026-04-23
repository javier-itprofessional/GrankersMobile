# Grankers Mobile — Arquitectura Técnica

> Guía de integración para el equipo de backend  
> React Native (Expo) · WatermelonDB · WebSocket  
> Última actualización: 2026-04-23 — ver [Changelog](#changelog)

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Expo + React Native | Expo SDK ~53, RN 0.81.5 |
| Routing | Expo Router (file-based) | ~6.0.23 |
| Base de datos local | WatermelonDB (SQLite/JSI) — schema v5 | 0.27.0 |
| Estado global | Zustand | 5.0.2 |
| Estado servidor | TanStack React Query | 5.83.0 |
| Peticiones HTTP | Fetch API (wrapper propio) | — |
| WebSocket | WebSocket nativo | — |
| Autenticación | Google Sign-In + Magic Link | — |
| Tokens seguros | Expo Secure Store | 15.0.8 |
| Monitoreo de red | NetInfo | 11.4.1 |
| Validación | Zod | 4.1.12 |
| Lenguaje | TypeScript | ~5.9.2 |

---

## Estructura de carpetas

```
GrankersMobile/
├── app/                    # Pantallas (Expo Router — file-based routing)
│   ├── _layout.tsx         # Root layout: providers + navegación
│   ├── index.tsx           # Pantalla de inicio / landing
│   ├── competition/        # Flujo de competición oficial
│   ├── free-play/          # Flujo de partida libre
│   ├── game/               # Pantallas de juego activo
│   └── player-area/        # Perfil del jugador y autenticación
│
├── services/               # Lógica de negocio y comunicación con backend
│   ├── api.ts              # Cliente HTTP con auto-refresh de token
│   ├── auth.ts             # Autenticación (Google + Magic Link)
│   ├── auth-storage.ts     # Almacenamiento seguro de tokens
│   ├── device.ts           # Gestión de Device ID
│   ├── course-service.ts   # Datos de campos de golf (con caché local)
│   ├── game-service.ts     # API de competición y free-play
│   ├── sync-engine.ts      # Cola de sincronización offline (batching + retry)
│   └── websocket.ts        # Cliente WebSocket con reconexión automática
│
├── providers/              # React Context — estado global de la app
│   ├── PlayerAuthProvider.tsx    # Sesión del jugador
│   ├── CompetitionProvider.tsx   # Estado de competición oficial
│   ├── FreePlayProvider.tsx      # Estado de partida libre
│   └── GameProvider.tsx          # (Legacy, en proceso de eliminación)
│
├── database/               # WatermelonDB
│   ├── index.ts            # Inicialización de la base de datos
│   ├── schema.ts           # Schema v5 (14 tablas, columnas en inglés)
│   ├── migrations.ts       # Migraciones incrementales v1→v5
│   └── models/             # Modelos WatermelonDB
│
├── lib/                    # Utilidades compartidas
├── components/             # Componentes UI reutilizables
├── types/                  # Interfaces TypeScript globales
├── assets/                 # Imágenes, iconos, fuentes
└── .env.local              # Variables de entorno
```

---

## Variables de entorno

```bash
# .env.local
EXPO_PUBLIC_API_URL=https://api.grankers.dev/api/1   # Base URL del API REST
EXPO_PUBLIC_WS_URL=wss://api.grankers.dev            # Base URL del WebSocket
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=1018...             # OAuth Google (iOS)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1018...             # OAuth Google (Web)
```

> Todas las variables públicas deben tener el prefijo `EXPO_PUBLIC_` para ser accesibles en el bundle.

---

## Autenticación

### Métodos soportados

| Método | Descripción |
|--------|-------------|
| Google OAuth | Sign-In nativo (requiere dev build, no funciona en Expo Go) |
| Magic Link | Email con enlace de verificación |
| Registro | Alta con email, nombre y país |

### Flujo Google OAuth

```
App → GoogleSignin.signIn() → idToken
    → POST /auth/mobile/google/
      Body: { id_token: string }
    ← { access: string, refresh: string, user: { uuid, first_name, last_name, email, country } }
```

### Flujo Magic Link

```
App → POST /auth/mobile/magic-link/
      Body: { email: string }
    ← 200 OK (backend envía email)

Usuario abre link → grankersmobile://auth/magic-link?token=...
App → POST /auth/mobile/magic-link/verify/
      Body: { token: string }
    ← { access: string, refresh: string, user: {...} }
```

### Flujo de Registro

```
App → POST /auth/mobile/register/
      Body: { email, first_name, last_name, country }
    ← 201 Created
```

### Gestión de tokens

- **Almacenamiento:** `expo-secure-store` (cifrado en el dispositivo)
- **Claves:** `access_token`, `refresh_token`
- **Refresh automático:** cualquier respuesta `401` dispara `POST /auth/mobile/refresh/`
- **Logout:** `POST /auth/mobile/logout/` + limpieza local de tokens

### Headers en todas las peticiones

```http
Authorization: Bearer {accessToken}
X-Device-ID: {deviceId}
Content-Type: application/json
```

### Device ID

- UUID v4 generado en el primer arranque
- Persistido en `expo-secure-store` con clave `device_id`
- Enviado en **todas** las peticiones como `X-Device-ID`
- Permite al backend identificar el dispositivo físico independientemente del usuario autenticado

---

## Cliente HTTP (`services/api.ts`)

```typescript
apiRequest<T>(path: string, options?: RequestInit): Promise<T>
```

- Base URL: `EXPO_PUBLIC_API_URL`
- Inyecta `Authorization` y `X-Device-ID` automáticamente
- Intercepta `401` → refresca tokens → reintenta la petición original
- Lanza error si el refresh también falla (sesión expirada)

---

## Endpoints REST

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/mobile/google/` | Login con Google |
| POST | `/auth/mobile/magic-link/` | Solicitar magic link |
| POST | `/auth/mobile/magic-link/verify/` | Verificar token del magic link |
| POST | `/auth/mobile/register/` | Registro de nuevo jugador |
| POST | `/auth/mobile/refresh/` | Refrescar access token |
| POST | `/auth/mobile/logout/` | Cerrar sesión |

### Campos de golf

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/courses/` | Listar todos los campos |
| GET | `/api/v1/courses/?nombre={course}&route={route}` | Campo y recorrido concreto |

**Response `GET /api/v1/courses/`:**
```json
[
  {
    "id": "string",
    "nombre": "string",
    "ciudad": "string",
    "pais": "string",
    "routes": [
      {
        "id": "string",
        "nombre": "string",
        "num_hoyos": 18,
        "par_total": 72,
        "slope": 113,
        "course_rating": 71.2,
        "holes": [
          { "hole_number": 1, "par": 4, "handicap": 7, "distancia_metros": 380 }
        ]
      }
    ]
  }
]
```

> Los campos se cachean localmente durante **24 horas** en WatermelonDB (`courses`, `routes`, `holes`).

### Competición

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/competitions/{codigo_grupo}/` | Datos de la competición |
| GET | `/api/v1/competitions/active/?device_id={id}` | Competición activa del dispositivo |
| GET | `/api/v1/competitions/{codigo_grupo}/players/{playerId}/scores/` | Puntuaciones del jugador |
| POST | `/api/v1/competitions/{codigo_grupo}/players/{playerId}/link-device/` | Vincular dispositivo al jugador |
| PATCH | `/api/v1/competitions/{codigo_grupo}/players/{playerId}/status/` | Actualizar estado de conexión |

**Response `GET /api/v1/competitions/{codigo_grupo}/`:**
```json
{
  "codigo_grupo": "string",
  "nombre_competicion": "string",
  "nombre_prueba": "string",
  "campo": "string",
  "recorrido": "string",
  "jugadores": [
    { "id": "string", "nombre": "string", "apellido": "string", "licencia": "string" }
  ]
}
```

### Free-Play

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/free-play/games/` | Crear partida libre |
| GET | `/api/v1/free-play/games/?course={course}&route={route}` | Listar partidas activas |

### Jugadores

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/players/search/?licencia=&nombre=&apellido=` | Buscar jugadores por licencia o nombre |

### Sincronización (el más importante)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/sync/` | Enviar lote de acciones pendientes |

Ver sección **Sync Engine** para el detalle completo.

---

## Sync Engine — Arquitectura offline-first

La app funciona completamente **sin conexión**. Todas las acciones del juego se almacenan localmente en `action_log` y se sincronizan con el backend cuando hay red.

### Flujo

```
Acción del usuario
      │
      ▼
syncEngine.record(action_type, payload, round_id)
      │
      ▼
  ActionLog (WatermelonDB)       ← persiste aunque se cierre la app
  sync_status = 'pending'
      │
      ├── [si hay conexión] → flush inmediato (non-blocking)
      └── [si no hay red]   → espera
                                │
                    ┌───────────┴──────────────┐
                    │  Triggers de flush:       │
                    │  • Timer 30s periódico    │
                    │  • Red restaurada         │
                    │  • syncEngine.flush()     │
                    └───────────┬──────────────┘
                                │
                                ▼
                    Batch (máx. 50 acciones)
                                │
                                ▼
                    POST /api/v1/sync/
                                │
                    ┌───────────┴──────────────┐
                    │ OK                        │ Error
                    ▼                           ▼
              syncedAt = now          retryCount++, lastError
                                      (máx. 5 reintentos)
```

### Request

```http
POST /api/v1/sync/
Authorization: Bearer {token}
X-Device-ID: {deviceId}
Content-Type: application/json

{
  "actions": [
    {
      "id": "uuid-local",
      "action_type": "HOLE_SAVED",
      "payload": { ... },
      "created_at": 1745234567890
    }
  ]
}
```

> `created_at` es timestamp en **milisegundos** (Unix ms).

### Response

```json
{
  "synced": ["uuid-1", "uuid-2"],
  "failed": [
    { "id": "uuid-3", "error": "validation_error: score out of range" }
  ]
}
```

### Parámetros de configuración

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `BATCH_SIZE` | 50 | Máximo de acciones por request |
| `MAX_RETRIES` | 5 | Reintentos antes de descartar la acción |
| `FLUSH_INTERVAL_MS` | 30.000 | Flush periódico (30 segundos) |

### Tipos de acción (`action_type`)

#### Scoring

| Tipo | Payload |
|------|---------|
| `HOLE_SAVED` | `{ hole_number, scores: [{ player_id, score, strokes_net? }] }` |
| `SCORE_AMENDED` | `{ hole_number, player_id, old_score, new_score, reason? }` |
| `PENALTY_ADDED` | `{ hole_number, player_id, penalty_strokes, reason }` |
| `NOTE_ADDED` | `{ hole_number?, text }` |

#### Estado de ronda

| Tipo | Payload |
|------|---------|
| `PLAYER_READY` | `{ player_id }` |
| `ROUND_STARTED` | `{ round_id, mode }` |
| `ROUND_FINISHED` | `{ round_id, mode }` |
| `ROUND_SUSPENDED` | `{ reason? }` |
| `ROUND_RESUMED` | `{ reason? }` |

#### Matchplay

| Tipo | Payload |
|------|---------|
| `CONCESSION` | `{ hole_number, conceding_player_id, beneficiary_player_id }` |
| `HOLE_WON` | `{ hole_number, winner_player_id }` |
| `HOLE_HALVED` | `{ hole_number }` |

#### Media

| Tipo | Payload |
|------|---------|
| `MEDIA_ATTACHED` | `{ attachment_id, attachment_type: 'photo'\|'document', hole_number? }` |
| `SIGNATURE_ADDED` | `{ attachment_id, signed_by_player_id }` |

### Idempotencia

El backend **debe ser idempotente por `id` de acción**. La app puede reenviar la misma acción si no recibe confirmación. Si el backend ya procesó un `id`, debe devolverlo en `synced[]` sin reprocesarlo.

---

## WebSocket — Actualizaciones en tiempo real

### Conexión

```
wss://{EXPO_PUBLIC_WS_URL}/ws/round/{roundId}/?token={accessToken}
```

- El `roundId` es el `id` del round en DB (`rounds.id`), tanto en competición como en free-play.
- El token JWT se envía como query param (no en header, por limitación de la API de WebSocket nativa).
- La app conecta al iniciar una ronda y desconecta al finalizarla.

### Reconexión automática

| Intento | Espera |
|---------|--------|
| 1 | 1 s |
| 2 | 2 s |
| 3 | 5 s |
| 4 | 10 s |
| 5+ | 30 s |

### Formato de mensajes (servidor → app)

```json
{
  "type": "leaderboard_updated",
  "payload": { ... }
}
```

### Eventos que la app escucha

#### `leaderboard_updated`
```json
{
  "type": "leaderboard_updated",
  "payload": {
    "round_id": "string",
    "leaderboard": [
      {
        "player_id": "string",
        "nombre": "string",
        "apellido": "string",
        "total_score": 72,
        "total_par": 72,
        "vs_par": 0,
        "holes_completed": 18
      }
    ]
  }
}
```
> La app almacena el payload completo en `leaderboard_cache` y lo muestra en pantalla.

#### `score_confirmed`
```json
{
  "type": "score_confirmed",
  "payload": {
    "round_id": "string",
    "player_id": "string",
    "hole_number": 5,
    "score": 4
  }
}
```

#### `player_status_changed`
```json
{
  "type": "player_status_changed",
  "payload": {
    "round_id": "string",
    "player_id": "string",
    "status": "preparado"
  }
}
```

Status válidos: `not_started` | `ready` | `playing` | `finished` | `withdrawn`

#### `round_finished`
```json
{
  "type": "round_finished",
  "payload": {
    "round_id": "string"
  }
}
```

---

## Base de datos local (WatermelonDB)

La app usa **WatermelonDB 0.27** sobre SQLite con JSI (JavaScript Interface) para máximo rendimiento. Toda la persistencia offline pasa por aquí.

### Inicialización

```typescript
// database/index.ts
const adapter = new SQLiteAdapter({
  schema,           // schema v4
  migrations,       // migraciones v1→v4
  dbName: 'grankers',
  jsi: true         // JSI habilitado
})

export const database = new Database({ adapter, modelClasses: [...] })
```

### Schema version: 5

| Tabla | Propósito |
|-------|-----------|
| `rounds` | Sesiones de juego |
| `round_players` | Participantes de cada ronda |
| `hole_scores` | Puntuaciones por hoyo |
| `action_log` | Cola de sincronización (event store) |
| `tour_events` | Caché de pruebas del tour |
| `players_cache` | Caché de jugadores |
| `leaderboard_cache` | Último leaderboard recibido |
| `media_attachments` | Fotos, docs y firmas |
| `rankings_cache` | Posiciones del ranking |
| `courses` | Campos de golf |
| `routes` | Recorridos |
| `holes` | Hoyos |
| `app_config` | Configuración clave-valor |
| `pending_sync` | (Legacy, en revisión) |

> Ver [data-model-v4.md](./data-model-v4.md) para el detalle completo de cada tabla.

---

## Providers — Estado global de la app

Los providers envuelven toda la app en `_layout.tsx` y exponen hooks para acceder al estado.

### `CompetitionProvider` / `useCompetition`

Gestiona el ciclo de vida de una competición oficial.

**Estado expuesto:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `competition` | `Competition \| null` | Datos de la competición activa |
| `currentHole` | `number` | Hoyo actual (1–18) |
| `holePars` | `number[]` | Par de cada hoyo |
| `playerScoresMap` | `Map<string, PlayerScores>` | Puntuaciones en memoria |
| `activeRoundId` | `string \| null` | ID del round en DB |
| `wsLeaderboard` | `LeaderboardEntry[] \| null` | Leaderboard vía WebSocket |
| `isOnline` | `boolean` | Estado de conectividad |
| `scoringMode` | `'all' \| 'partial'` | Quién puntúa |

**Acciones principales:**

```typescript
startCompetition(comp)     // Crea Round + RoundPlayer + HoleScore en DB, conecta WS
updateScore(id, hole, n)   // Actualiza en memoria (sin persistir)
saveHole(hole)             // Persiste hole_scores + genera acción HOLE_SAVED
finishCompetition()        // ROUND_FINISHED + flush del sync engine
resetCompetition()         // Borra registros en DB, desconecta WS
```

### `FreePlayProvider` / `useFreePlay`

Idéntico a `CompetitionProvider` pero para partidas libres (`mode='free-play'`).

### `PlayerAuthProvider` / `usePlayerAuth`

```typescript
session: PlayerSession | null   // { id, name, email, country, authMethod }
isAuthenticated: boolean
reloadSession()                 // Recargar tras login
clearSession()                  // Logout
```

La sesión se extrae del payload JWT decodificado localmente (sin petición adicional al backend).

---

## Navegación (Expo Router)

Routing basado en el sistema de ficheros. Cada archivo en `app/` es una ruta.

```
/                           → app/index.tsx           (landing)
/competition/code-entry     → app/competition/code-entry.tsx
/competition/select-player  → app/competition/select-player.tsx
/competition/waiting-players→ app/competition/waiting-players.tsx
/game/scoring               → app/game/scoring.tsx
/game/leaderboard           → app/game/leaderboard.tsx
/game/scorecard             → app/game/scorecard.tsx
/game/complete              → app/game/complete.tsx
/free-play/select-course    → app/free-play/select-course.tsx
/free-play/waiting-players  → app/free-play/waiting-players.tsx
/player-area                → app/player-area/index.tsx
/player-area/login          → app/player-area/login.tsx
/player-area/competitions   → app/player-area/competitions.tsx
```

**Deep linking** configurado para:
- `grankersmobile://auth/magic-link?token=...` → verificación de magic link

---

## Flujos principales de integración

### 1. Competición oficial

```
1. Jugador introduce código de grupo
   → GET /api/v1/competitions/{codigo_grupo}/
   → App crea Round en DB con los jugadores

2. Jugador selecciona su perfil en el dispositivo
   → POST /api/v1/competitions/{codigo_grupo}/players/{playerId}/link-device/
     Body: { device_id: string }
   → WS conecta a /ws/round/{codigo_grupo}/

3. Jugador marca "preparado"
   → PATCH /api/v1/competitions/{codigo_grupo}/players/{playerId}/status/
     Body: { status: "preparado" }
   → Backend emite player_status_changed por WS

4. Juego en curso
   → Puntuaciones se guardan localmente (HoleScore)
   → Cada saveHole genera HOLE_SAVED en action_log
   → SyncEngine envía a POST /api/v1/sync/ en batches

5. Fin de ronda
   → ROUND_FINISHED en action_log
   → syncEngine.flush() forzado
```

### 2. Partida libre (Free-Play)

```
1. Jugador selecciona campo y recorrido
   → GET /api/v1/courses/ (con caché 24h local)

2. Crea o se une a una partida
   → POST /api/v1/free-play/games/
   → GET /api/v1/free-play/games/?course=&route=

3. Juego igual que competición
   → HoleScore local + action_log + sync

4. Al terminar
   → ROUND_FINISHED + flush
```

### 3. Pipeline de Media (fotos / firmas)

```
1. Usuario captura foto o firma
   → media_attachments creado localmente (upload_status = 'pending')
   → action_log: MEDIA_ATTACHED / SIGNATURE_ADDED (con attachment_id)

2. Pipeline de subida (independiente del sync engine)
   → upload_status = 'uploading'
   → Subida binaria a CDN / S3
   → Éxito: remote_url guardado, upload_status = 'synced'
   → Error: upload_status = 'failed', lastError, reintentable

3. Backend recibe primero el evento (action_log) con el attachment_id
   y después el binario desde el pipeline de media
```

---

## Consideraciones para el backend

### Idempotencia en `/api/v1/sync/`
Las mismas acciones pueden llegar varias veces. El backend debe deduplicar por `id` de acción. Si un `id` ya fue procesado, devolver en `synced[]` sin reprocesar.

### Timestamps
Todos los `created_at` en `action_log` son **timestamps en milisegundos** (Unix ms), no segundos.

### `X-Device-ID`
Presente en **todas** las peticiones. Permite rastrear qué dispositivo físico realizó cada acción, independientemente del usuario autenticado. Es un UUID v4 generado una sola vez por dispositivo.

### `player_external_id` vs `player_id`
- `player_external_id` → ID del jugador en el sistema del backend (viene de `/api/v1/competitions/` o de `players_cache`)
- `player_id` en `round_players` → FK a `players_cache.external_id` en local (puede ser null si no está en caché)

### WebSocket — `round_id`
La app conecta al canal `/ws/round/{roundId}/` usando el `id` del round (`rounds.id`). El backend debe emitir eventos a ese canal cuando hay actualizaciones.

### `tour_events` / `players_cache` / `rankings_cache`
Estas tablas se rellenan mediante sync pull desde el backend. La app necesita endpoints (o incluirlos en la respuesta de `/api/v1/sync/`) para mantenerlas actualizadas.

### `leaderboard_cache`
El leaderboard llega por WebSocket (`leaderboard_updated`). Si el WS no está disponible, la app usa el último snapshot local. El backend debería emitir este evento cada vez que cambia una puntuación.

---

## Changelog

### 2026-04-23 — Renombrado de identificadores internos a inglés

**Cambio interno — no afecta al wire protocol con el backend.**

El código TypeScript del cliente usa ahora inglés para todos los identificadores. El backend
sigue enviando JSON en español en los endpoints de competición; `game-service.ts` aplica una
capa de transformación en la frontera de la API.

**Capa de transformación (`services/game-service.ts`)**

- Interfaces wire añadidas: `WireCompetitionData`, `WirePlayer`, `WireActiveCompetition`, `WireLicensePlayer`
- `fetchCompetitionData()` → transforma campos españoles del backend a `FirebaseCompetitionData` (inglés)
- `findCompetitionByDeviceId()` → transforma a `FoundCompetitionSession` (inglés)
- `searchPlayerLicenses()` → envía params en español (`licencia`, `nombre`, `apellido`, `codigo_grupo`); devuelve `LicensePlayer[]` en inglés
- `saveFreePlayPlayers()` → mapea `firstName/lastName/license` → `nombre/apellido/licencia` para el request body

**Tipos internos renombrados (`types/game.ts`)**

| Antes | Después |
|-------|---------|
| `Competition.codigo_grupo` | `Competition.groupCode` |
| `Competition.nombre_competicion` | `Competition.competitionName` |
| `Competition.nombre_prueba` | `Competition.eventName` |
| `Competition.jugadores` | `Competition.players` |
| `Player.nombre` | `Player.firstName` |
| `Player.apellido` | `Player.lastName` |
| `Player.licencia` | `Player.license` |

**Schema WatermelonDB v5**

- Todas las columnas renombradas a inglés (migración v4→v5 en `migrations.ts`)
- Modelos actualizados: `Round`, `RoundPlayer`, `HoleScore`, `ActionLog`, `PlayerCache`, `TourEvent`, `Course`, `Route`, `Hole`

**WebSocket**

- `player_status_changed.status` usa vocabulario inglés: `not_started | ready | playing | finished | withdrawn`
- Canal WS: `rounds.id` (no `codigo_grupo`)

---

### 2026-04-22 — Alineación con `mobile-sync-spec.md` v2.4.0

**Wire protocol (`services/sync-engine.ts`)**
- `created_at` usa Unix ms (`number`) — no ISO 8601
- Campo de error en `failed[]`: `reason` (string)
- Backoff de reintentos: immediate → 5 s → 30 s → 2 min → 10 min
- Errores no reintentables (Set explícita): `invalid_payload`, `unauthorized`, `not_found`, `session_locked`

**Payloads de `action_log` (`database/models/ActionLog.ts`) — spec §2.x**

| Evento | Shape wire |
|--------|-----------|
| `HOLE_SAVED` | `{ round_id, hole_number, scores: [{player_id, score, strokes_net?}] }` — un solo evento por hoyo para todo el grupo |
| `SCORE_AMENDED` | `{ round_id, player_id, hole_number, old_score, new_score, reason? }` |
| `PENALTY_ADDED` | `{ round_id, player_id, hole_number, penalty_strokes, reason? }` |
| `ROUND_STARTED` | `{ round_id, mode, codigo_grupo?, tour_event_id?, course_name?, route_name?, tee_color?, hole_pars?, hole_handicaps?, players? }` |
| `CONCESSION` | `{ round_id, hole_number, conceding_player_id, beneficiary_player_id }` |
| `MEDIA_ATTACHED` | `{ round_id, hole_number?, attachment_id, attachment_type: 'photo'\|'video'\|'signature' }` |
| `SIGNATURE_ADDED` | `{ round_id, attachment_id, signed_by_player_id }` |

**WebSocket tipos (`services/websocket.ts`) — spec §4**

| Evento | Shape |
|--------|-------|
| `leaderboard_updated` | `{ round_id, leaderboard: [{position, player_id, nombre, apellido, total_score, vs_par, holes_completed}] }` |
| `score_confirmed` | `{ action_id, materialized: boolean }` |
| `player_status_changed` | `{ player_id, status: 'not_started'\|'ready'\|'playing'\|'finished'\|'withdrawn' }` |
| `round_finished` | `{ round_id, closed_at }` |

**Nuevos servicios**

| Archivo | Endpoint |
|---------|----------|
| `services/bootstrap.ts` | `POST /api/v1/sync/bootstrap/` — descarga inicial; `GET /api/v1/sync/status/` — health check |
| `services/media-upload.ts` | `POST /api/v1/sync/media/` — subida multipart; `POST /api/v1/sync/device/register/` — token FCM/APNs |
| `services/api.ts` | Añadida `apiRequestFormData()` — multipart con auth gestionada igual que `apiRequest()` |

---

### 2026-04-21 — Schema local v4 + migración Firebase → WatermelonDB

- Base de datos migrada de Firebase RTDB a WatermelonDB 0.27 (SQLite/JSI)
- Schema v4: 14 tablas (5 nuevas: `tour_events`, `players_cache`, `leaderboard_cache`, `media_attachments`, `rankings_cache`)
- Columnas añadidas: `rounds.tour_event_id`, `round_players.player_id`, `hole_scores.strokes_net`
- `ActionType` extendido de 4 a 14 tipos con payload interfaces tipados
- Nuevo `SyncEngine`: cola offline con batching (50 acciones/req) y flush periódico (30 s)
- Nuevo `WebSocketClient`: reconexión automática con backoff escalonado
- Eliminada dependencia `firebase` del `package.json`
