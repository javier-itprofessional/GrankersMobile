# Backend TODO — Integración Mobile

> Generado 2026-04-24. Última actualización 2026-04-26.  
> Referencia: `docs/todo.md` (lado mobile), `docs/technical-architecture.md`.  
> Estado mobile: branch `local_database_updates` (v2 cleanup + tests completados).

---

## Ships de backend incorporados desde última sync (2026-04-24)

| Commit | Qué shippeó | Impacto mobile |
|--------|-------------|----------------|
| `c1e6c665` | `effective_scoring_entry_mode` rename permanente en `/competitions/{group_code}/` y `/sync/pull/` | Mobile eliminó alias `scoring_entry_mode` (§v2-cleanup.1 ✅) |
| `a89e62e8` | `GET /api/v1/scoring/leaderboard/{group_code}/` | REST fallback del WS ya llega a endpoint real (B-2 ✅) |
| `c1e6c665` | Campos extra en `/competitions/active/`: `route_name`, `player_id`, `player_first_name`, `player_last_name` | Mobile puede prescindir de la segunda llamada a `/competitions/{group_code}/` para identidad del jugador |
| `f3ab6c41` | `vs_par` numérico en `leaderboard_updated` WS + REST leaderboard | Líderes en rondas parciales se muestran correctamente |

> **Pendiente confirmar:** I-1 — campo `reason` vs `error` en `/api/v1/sync/` (ver abajo).

---

## Resumen ejecutivo

Mobile está **completo** en todos los contratos acordados. Este fichero recoge:
- Endpoints que mobile consume y cuyo contrato necesita verificación final
- Endpoints nuevos que mobile implementó pero backend aún no ha confirmado
- Correcciones pendientes en `technical-architecture.md`
- Casos de borde que necesitan aclaración

---

## 🔴 Bloqueantes — Sin esto la app no funciona en staging

### B-1 — Canal WebSocket: clave = `ScoringSession.uuid` ← CRÍTICO

Mobile ya fue corregido: ahora conecta a `wss://{WS_URL}/ws/round/{session_uuid}/` donde
`session_uuid` es el UUID del `ScoringSession` devuelto por el backend, **no** el ID local de WatermelonDB.

**Qué debe hacer backend:**
- El canal WS debe ser enrutable por `ScoringSession.uuid`
- Todos los eventos (`leaderboard_updated`, `score_confirmed`, `player_status_changed`, `round_finished`) deben emitirse a ese canal
- Si el canal sigue siendo `group_code` o algún otro identificador, comunicarlo a mobile para revertir

**Endpoint afectado:** `wss://{WS_URL}/ws/round/{session_uuid}/?token=<jwt>`

---

### B-2 — `GET /api/v1/scoring/leaderboard/{group_code}/` — Endpoint nuevo

Mobile implementó un REST fallback que se activa cuando el WS cae 3 veces consecutivas.
Cada 15s llama a este endpoint y usa la respuesta para actualizar el leaderboard.

**Shape esperado:**
```json
{
  "leaderboard": [
    {
      "position": 1,
      "player_id": "<uuid>",
      "first_name": "Alice",
      "last_name": "Doe",
      "total_score": 68,
      "vs_par": -4,
      "holes_completed": 18
    }
  ]
}
```

> Mismo shape que el payload de `leaderboard_updated` por WS.  
> Si la URL real es diferente (por ejemplo `/api/v1/competitions/{group_code}/leaderboard/`), avisar a mobile.

**Estado backend:** ✅ shipped `a89e62e8` — `vs_par` numérico también confirmado (`f3ab6c41`)

---

### B-3 — `GET /api/v1/competitions/{group_code}/` — Campos nuevos requeridos

Mobile espera estos campos en la respuesta (además de los ya existentes):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `session_uuid` | `string` | UUID del `ScoringSession` activo para este grupo |
| `effective_scoring_entry_mode` | `'all' \| 'partial'` | Quién puede introducir scores en el dispositivo |

**Shape completo esperado:**
```json
{
  "group_code": "ABC12",
  "competition_name": "Spring Open 2026",
  "event_name": "Round 1",
  "course_name": "Valderrama Course",
  "route_name": "Black (Male)",
  "session_uuid": "<scoring-session-uuid>",
  "effective_scoring_entry_mode": "all",
  "players": [
    { "id": "<uuid>", "first_name": "Alice", "last_name": "Doe", "license": "123", "handicap": 12.5 }
  ]
}
```

**Estado backend:** `session_uuid` ✅ shipped · `effective_scoring_entry_mode` ✅ shipped (verificar nombre exacto del campo)

---

### B-4 — `GET /api/v1/competitions/active/?device_id={id}` — Campos nuevos requeridos

Mobile usa este endpoint para obtener la sesión activa del dispositivo al arrancar.

**Shape completo esperado:**
```json
{
  "uuid": "<scoring-session-uuid>",
  "status": "in_progress",
  "mode": "competition",
  "group_code": "ABC12",
  "competition_name": "Spring Open 2026",
  "event_name": "Round 1",
  "course_name": "Valderrama Course",
  "route_name": "Black (Male)",
  "player_id": "<uuid>",
  "player_first_name": "Alice",
  "player_last_name": "Doe"
}
```

> `uuid`, `competition_name` y `event_name` son campos nuevos. Los demás ya existían.

**Estado backend:** ✅ shipped — verificar que `uuid` (ScoringSession.uuid) está incluido

---

## 🟡 Importantes — Necesarios para QA end-to-end

### I-1 — `POST /api/v1/sync/` — Campo `reason` en `failed[]`

Mobile espera `reason`, no `error`:

```json
{
  "synced": ["uuid-1"],
  "failed": [
    { "id": "uuid-2", "reason": "invalid_payload: score out of range" }
  ]
}
```

Mobile filtra estos prefijos como **no reintentables**: `invalid_payload`, `unauthorized`, `not_found`, `session_locked`.  
Si el backend devuelve `"error"` en lugar de `"reason"`, los fallos transitorios nunca se reintentan.

**Estado backend:** ⬜ Verificar nombre del campo

---

### I-2 — `GET /api/v1/sync/pull/?since=<unix_ms>` — Shape de respuesta

Mobile consume este endpoint cada 5 minutos y al volver a primer plano.
El parámetro `since` es **Unix timestamp en milisegundos**.

**Shape esperado:**
```json
{
  "tour_events": [
    {
      "id": "<uuid>",
      "competition_name": "Spring Open 2026",
      "event_name": "Round 1",
      "date": "2026-04-24",
      "tee_time": "10:30",
      "format": "stroke_play",
      "status": "in_progress",
      "group_code": "ABC12",
      "course_name": "Valderrama Course",
      "route_name": "Black (Male)"
    }
  ],
  "players_cache": [
    {
      "external_id": "<uuid>",
      "first_name": "Alice",
      "last_name": "Doe",
      "license": "MAD-12345",
      "handicap_index": 12.5,
      "avatar_url": "https://cdn.grankers.com/avatars/..."
    }
  ],
  "server_time_ms": 1745234567890
}
```

> `server_time_ms` es **crítico** — mobile lo usa como watermark para la próxima llamada.  
> Si alguno de los arrays está vacío o no hay cambios, devolver `[]` (no omitir la clave).

**Estado backend:** ✅ shipped 7.2.b — verificar que `server_time_ms` está presente

---

### I-3 — `POST /api/v1/sync/bootstrap/` — Comportamiento esperado

Mobile llama a este endpoint al arrancar si han pasado más de 24h desde la última llamada.

**Request:** `POST` sin body (o body vacío `{}`).

**Response esperada:** Mobile ignora el cuerpo actualmente. Si el backend quiere que mobile consuma datos del bootstrap (tour_events, players, leaderboard), comunicarlo para añadir el parsing.

**Estado backend:** ✅ shipped — ⬜ confirmar si la respuesta incluye datos consumibles

---

### I-4 — `GET /api/v1/courses/` — Campos de recorrido

Cada objeto `route` dentro del array de `routes` debe incluir:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tee_color` | `string?` | Color del tee (ej. `"white"`, `"red"`, `"yellow"`) |
| `gender` | `string?` | Género del recorrido (ej. `"male"`, `"female"`) |
| `total_distance` | `number?` | Distancia total en metros |

**Estado backend:** ✅ shipped 7.1.a

---

### I-5 — `GET /api/v1/players/search/` — Campo `avatar_url`

Mobile muestra el avatar del jugador en los resultados de búsqueda.

**Shape esperado por cada elemento:**
```json
{
  "external_id": "<uuid>",
  "license": "MAD-12345",
  "first_name": "Alice",
  "last_name": "Doe",
  "handicap_index": 12.5,
  "avatar_url": "https://cdn.grankers.com/avatars/alice.jpg"
}
```

> `avatar_url` puede ser `null` si el jugador no tiene foto. Mobile muestra iniciales como fallback.

**Estado backend:** ✅ shipped 7.2.c

---

### I-6 — WS `leaderboard_updated` — Shape English wire

Mobile espera el payload en inglés. Verificar que backend emite:

```json
{
  "type": "leaderboard_updated",
  "payload": {
    "round_id": "<session-uuid>",
    "leaderboard": [
      {
        "position": 1,
        "player_id": "<uuid>",
        "first_name": "Alice",
        "last_name": "Doe",
        "total_score": 68,
        "vs_par": -4,
        "holes_completed": 18
      }
    ]
  }
}
```

> **Importante:** campos deben ser `first_name`/`last_name` — **no** `nombre`/`apellido`.  
> `round_id` debe ser el `ScoringSession.uuid` (igual que el canal WS).

**Estado backend:** ✅ shipped — verificar campo `position` incluido

---

### I-7 — WS `score_confirmed` — Shape

```json
{
  "type": "score_confirmed",
  "payload": {
    "action_id": "<action-log-uuid>",
    "materialized": true
  }
}
```

> `action_id` es el `id` de la acción en `action_log` (el UUID local del cliente).  
> Mobile usa esto para confirmar que el servidor procesó la acción — **no** para marcarla como synced (eso lo hace el HTTP 200 del POST /sync/).

**Estado backend:** ✅ shipped 7.1.c

---

### I-8 — WS `player_status_changed` — Shape

```json
{
  "type": "player_status_changed",
  "payload": {
    "player_id": "<uuid>",
    "status": "withdrawn"
  }
}
```

Status válidos: `not_started` | `ready` | `playing` | `finished` | `withdrawn`

> Mobile actúa sobre estos eventos del organizador:
> - `withdrawn` → alerta "Retirado" + bloquea entrada de scores
> - `not_started` (si prev era `ready/playing`) → alerta "Desvinculado" + bloquea entrada
>
> Es crítico que el backend emita el evento cuando el organizador hace estas acciones desde el dashboard web.

**Estado backend:** ✅ backend emite

---

### I-9 — WS `round_finished` — Shape

```json
{
  "type": "round_finished",
  "payload": {
    "round_id": "<session-uuid>",
    "closed_at": "2026-04-24T15:30:00Z"
  }
}
```

> Mobile bloquea la entrada de scores al recibir este evento.

**Estado backend:** ✅ backend emite

---

## 🟢 Informativos — Cambios mobile que backend debe conocer

### N-1 — `POST /api/v1/sync/` — Idempotencia por `id`

Mobile puede reenviar la misma acción si no recibe confirmación. El backend **debe** deduplicar por `id`:
- Si `id` ya fue procesado → devolver en `synced[]` sin reprocesar
- Nunca devolver error por duplicado

**Payload `HOLE_SAVED`** (un único evento por hoyo para todo el grupo):
```json
{
  "id": "<uuid>",
  "action_type": "HOLE_SAVED",
  "payload": {
    "round_id": "<session-uuid>",
    "hole_number": 5,
    "scores": [
      { "player_id": "<uuid>", "score": 4 },
      { "player_id": "<uuid>", "score": 5 }
    ]
  },
  "created_at": 1745234567890
}
```

> `created_at` es **Unix ms** (no segundos, no ISO 8601).

---

### N-2 — `X-Device-ID` — Formato UUID v4

Mobile genera `crypto.randomUUID()` → 36 caracteres, hexadecimal + guiones.  
Ejemplo: `f47ac10b-58cc-4372-a567-0e02b2c3d479`

El validador regex de backend ya acepta este formato (✅ confirmado).

---

### N-3 — Free-play: `route_uuid` en `POST /api/v1/free-play/games/`

Mobile envía `route_uuid` en el body de creación de partida libre:

```json
{
  "course_uuid": "<uuid>",
  "route_uuid": "<uuid>",
  "game_name": "Sunday Friendlies",
  "tee_color": "white",
  "players": [...]
}
```

Y espera que el response incluya `route_uuid` para confirmarlo:
```json
{
  "uuid": "<session-uuid>",
  "route_uuid": "<uuid>",
  ...
}
```

**⬜ QA pendiente:** crear partida con `route_uuid` y verificar que backend lo almacena y devuelve.

---

### N-4 — Auth refresh: `X-Device-ID` obligatorio

`POST /auth/mobile/refresh/` siempre lleva `X-Device-ID` en headers. Backend debe aceptarlo (no rechazar si no lo esperaba).

---

## 📋 Correcciones en `technical-architecture.md`

El doc está desactualizado en varios puntos. Backend debe actualizar antes del release:

| Línea | Actual (incorrecto) | Correcto |
|-------|---------------------|----------|
| ~15 | Schema v5 | Schema v7 (ver `database/schema.ts`) |
| ~54 | Menciona `GameProvider.tsx` | Eliminado — ya no existe |
| ~447 | Canal WS: `/ws/round/{roundId}/` donde `roundId = rounds.id` | `roundId = ScoringSession.uuid` |
| ~480 | WS payload: `nombre`, `apellido` | `first_name`, `last_name` |
| ~555-565 | Schema: `pending_sync` en tabla list | Eliminada en schema v7 |
| ~593 | `CompetitionProvider` state: falta `isSessionActive` | Añadir `isSessionActive: boolean` |
| ~659 | Flujo competición: `WS conecta a /ws/round/{codigo_grupo}/` | WS conecta a `/ws/round/{session_uuid}/` |

---

## 📊 Estado global por área

| Área | Backend | Estado |
|------|---------|--------|
| Auth (Google, Magic Link, Refresh, Logout) | ✅ | Funcionando |
| `GET /api/v1/courses/` con route fields | ✅ shipped 7.1.a | Funcionando |
| `GET /api/v1/competitions/{group_code}/` | ✅ con session_uuid + scoring_mode | Verificar shapes |
| `GET /api/v1/competitions/active/` | ✅ con competition_name + event_name | Verificar uuid |
| `POST /api/v1/competitions/.../link-device/` | ✅ | Funcionando |
| `PATCH /api/v1/competitions/.../status/` | ✅ | Funcionando |
| `POST /api/v1/free-play/games/` | ✅ | QA con route_uuid pendiente |
| `GET /api/v1/free-play/games/` | ✅ | Funcionando |
| `GET /api/v1/players/search/` con avatar_url | ✅ shipped 7.2.c | Funcionando |
| `POST /api/v1/sync/` con idempotencia | ✅ | Verificar campo `reason` |
| `GET /api/v1/sync/pull/?since=` | ✅ shipped 7.2.b | Verificar `server_time_ms` |
| `POST /api/v1/sync/bootstrap/` | ✅ shipped | Verificar si response tiene datos |
| `GET /api/v1/scoring/leaderboard/{group_code}/` | ✅ shipped `a89e62e8` | Funcionando |
| WS canal por `ScoringSession.uuid` | ✅ | Verificar routing |
| WS `leaderboard_updated` English fields | ✅ | Verificar `position` + `first_name` |
| WS `score_confirmed` | ✅ shipped 7.1.c | Funcionando |
| WS `player_status_changed` (organizer) | ✅ backend emite | Funcionando |
| WS `round_finished` | ✅ backend emite | Funcionando |
