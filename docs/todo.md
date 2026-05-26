# Mobile TODO — Backend Integration

> Actualizado 2026-05-26.  
> Referencia cruzada: backend `tasks/mobile-sync-todo.md` Phase 7.

---

## Tracker de estado

| ID | Descripción | Backend | Mobile | Notas |
|---|---|---|---|---|
| §1.a.bis | Route: `tee_color`, `gender`, `total_distance` | ✅ shipped 7.1.a | ✅ **done** (schema v6, model, course-service) | — |
| §1.b | Route en creación de sesión (`route_uuid`) | ✅ | ✅ done prev | QA pendiente end-to-end |
| §1.c | `competition_name`+`event_name` en `/active/` | ✅ shipped | ✅ **done** (game-service §1.d) | Simplificado: activo devuelve ambos campos |
| §1.e | `session_uuid` en `/competitions/{group_code}/` | ✅ shipped | ✅ **done** | Almacenado en `rounds.session_uuid` |
| §2.b | `score_confirmed` WS — publisher Celery | ✅ shipped 7.1.c | ✅ consumer cableado | No bloquea cola (syncedAt = HTTP 200) |
| §2.c | `leaderboard_updated` — English payload | ✅ shipped | ✅ done prev | `first_name`, `last_name` en wire |
| §2.e | WS canal: `ScoringSession.uuid` no `round.id` | ✅ | ✅ **done** | CompetitionProvider + FreePlayProvider usan `session_uuid` |
| §2.f | Validador regex `X-Device-ID` | ✅ | ✅ uuid v4 pasa | `crypto.randomUUID()` — 36 chars hex+guiones |
| §2.g | Organizer unlink → `not_started` | ✅ backend emite | ✅ **done** | Alert + isSessionActive=false |
| §2.h | Organizer lifecycle (round_finished) | ✅ backend emite | ✅ **done** | isSessionActive=false en CompetitionProvider + FreePlayProvider |
| §2.i | Organizer withdraw → `withdrawn` | ✅ backend emite | ✅ **done** | Alert + isSessionActive=false |
| §3 | Sync pull incremental `GET /sync/pull/?since=` | ✅ shipped 7.2.b | ✅ **done** | SyncEngine.pull() + AppState only (interval eliminado) |
| Phase 7.2.a | Bootstrap leaderboards en /sync/bootstrap/ | ✅ shipped | ✅ **done** | SyncEngine.bootstrap() — 24h guard + AppState |
| Phase 7.2.b | Re-bootstrap ≥24h inactivity | ✅ shipped | ✅ **done** | `last_bootstrap_ms` en app_config; comprobado en start() y foreground |
| Phase 7.2.c | `avatar_url` real en /players/search/ | ✅ shipped | ✅ **done** | `SearchResultCard` muestra imagen |
| §4.a | Tabla `pending_syncs` legacy | — | ✅ **done** | Drop en schema v7, modelo y offline-sync limpiados |
| §4.b | `GameProvider` legacy | — | ✅ **done** | Eliminado; review.tsx usa useCompetition/useFreePlay |
| §4.c | Logs/toasts con tokens españoles | — | ✅ limpio | Grep confirma 0 hits de wire tokens fuera de migrations |
| §4.d | `free-play/waiting-players.tsx` obsoleto | — | ✅ **done** | Eliminado |
| §4.e | `free-play/search-license.tsx` — params legacy | — | ✅ **done** | `groupName` eliminado de params type y push |
| §5.a | `effective_scoring_entry_mode` en CompetitionProvider | ✅ shipped | ✅ **done** | `FirebaseCompetitionData` + `Competition.scoringMode` + startCompetition |
| §5.b | Leaderboard REST fallback (WS cae 3×) | ✅ | ✅ **done** | `max_retries_reached` → poll `GET /scoring/leaderboard/{groupCode}/` cada 15s |
| §5.c | WS `reconnected` cancela poll REST | ✅ | ✅ **done** | `reconnected` event en wsClient detiene el intervalo |
| S-1 | HTTP 400 en POST /sync/ no reintenta | ✅ (backend devuelve 400) | ✅ **done** | `nextRetryAt = MAX_SAFE_INTEGER` + `retryCount = MAX_RETRIES` |
| §6.a | `syncEngine.stop()` al terminar sesión (withdrawn) | ✅ emite WS | ✅ **done** | CompetitionProvider — stop() + Alert |
| §6.b | Input de puntuación bloqueado si sesión terminada | — | ✅ **done** | `canEdit` incluye `isSessionActive` en scoring.tsx |
| §6.c | `syncEngine.stop()` al desvincularse el dispositivo | ✅ emite WS | ✅ **done** | CompetitionProvider — stop() + Alert |
| §8.a | `playing_handicap` y `tee_color` en endpoint jugadores | ✅ **shipped** | ✅ **done** | competitions.py ya los devuelve; code-entry.tsx los consume |
| §8.c | `group_code` en upcoming-events | ⬜ **pendiente** | ✅ ready | UpcomingEvent ya tiene el campo; solo falta backend |
| §9.a | `scored_by` en HOLE_SAVED payload | ✅ spec | ✅ **done** | `HoleSavedPayload.scores` incluye `scored_by: string` |
| §9.b | `conflictScoreLocal`/`Marker` en HoleScore state | — | ✅ **done** | Tipos, DB reads en carga inicial, escritura en saveHole |
| §9.c | WS handler `score_confirmed` enriquecido | ⬜ pendiente backend | ✅ **done** | CompetitionProvider escucha y escribe conflict fields a DB |
| §9.d | `amendScore` callback | — | ✅ **done** | DB + state + `SCORE_AMENDED` action log |
| §9.e | `comprobacion.tsx` cruce de puntuaciones | — | ✅ **done** | Columnas Marc./Yo, banner de conflictos, edición inline |

---

## §0 — Hard cutover English wire protocol

### ✅ Completado en 2026-04-24

- `services/game-service.ts` — Wire* Spanish interfaces eliminadas; `fetchCompetitionData`, `findCompetitionByDeviceId`, `searchPlayerLicenses` actualizados.
- `app/index.tsx` — scores lookup corregido (`holes[].hole_number` / `strokes`).
- Free-play flat model implementado: `createFreePlayGame`, `listFreePlayGames`, `getActiveGamePlayers` reescritos.
- Screens `select-course`, `create-game`, `setup`, `select-device-player` adaptadas.

### ⚠️ 0.h — Verificación final de tokens españoles

Después de mergear este branch, ejecutar:

```
grep -rn "nombre\|apellido\|licencia\|codigo_grupo\|nombre_competicion\|nombre_prueba\|jugadores\|campo\|recorrido\|hoyo_\|golpes_jugador\|player_nombre\|player_apellido" --include="*.ts" --include="*.tsx" src/ app/ services/ providers/ types/
```

Resultado esperado: **0 hits** fuera de `docs/` y `build_info.txt/`.

### ⚠️ 0.i — Coordinación de release

- Backend `mobile-sync` branch (commit `b8b1c67`) ya en inglés.
- Coordinar con `#mobile-sync` para que el deploy de backend y el build mobile vayan juntos a staging.

---

## §1 — Contratos completados

### ✅ 1.a.bis — Route: campos faltantes en schema + modelo

- Schema v5→v6: columnas `tee_color` (string, optional), `gender` (string, optional), `total_distance` (number, optional) en tabla `routes`
- `database/models/Route.ts`: `teeColor`, `gender`, `totalDistance`
- `services/course-service.ts`: `WireRouteData`, `RouteData`, `transformCourse`, `getFromCache`, `persistCourse` actualizados

### ✅ 1.c/d — `competition_name`, `event_name` y `session_uuid` en endpoints

- `WireActiveSession` ahora incluye `competition_name`, `event_name` (§1.d — backend shipped)
- `findCompetitionByDeviceId` usa datos del `/active/` para competition_name/event_name; obtiene `session_uuid` de `/competitions/{group_code}/`
- `FirebaseCompetitionData` y `FoundCompetitionSession` incluyen `session_uuid?`

### ⬜ 1.b — Route como entidad de primer nivel en creación de sesión

- [ ] QA: crear partida libre con campo + recorrido → comprobar que el servidor acepta el body y devuelve `route_uuid` en la sesión

---

## §2 — Comportamientos de backend

### ✅ 2.b — `score_confirmed` WS (Phase 7.1.c)

El handler está cableado. El publisher Celery ya activo.

- `syncedAt = now` en HTTP 200 es correcto — no ata a WS
- `syncEngine` NO bloquea en `score_confirmed`

### ✅ 2.e — Clave de canal WS es `ScoringSession.uuid` ← CRÍTICO

**Corregido en 2026-04-24.**

- Schema v6: columna `session_uuid` en tabla `rounds`
- `Round.sessionUuid` almacena el UUID de backend
- `CompetitionProvider`: carga inicial y `startCompetition` usan `round.sessionUuid ?? round.id`
- `FreePlayProvider`: `startFreePlay(players, sessionUuid?)` almacena UUID en round y conecta WS; carga inicial también conecta WS
- `setup.tsx` captura `ScoringSession.uuid` de `createFreePlayGame` y pasa como `sessionUuid` param
- `select-device-player.tsx` pasa `sessionUuid` a `startFreePlay`

### ✅ 2.f — Validador regex de `X-Device-ID` en backend

- `crypto.randomUUID()` v4 pasa (36 chars, hex + guiones ✅)

### ✅ 2.g — Organizer-initiated unlink

- `player_status_changed` donde `status === 'not_started'` y prev era `ready/playing` → Alert + `isSessionTerminated = true`
- Aplicado en `CompetitionProvider` y `FreePlayProvider`

### ✅ 2.h — Organizer lifecycle changes

- `round_finished` WS → `isSessionTerminated = true` en ambos providers
- `saveHole` gateado por `isSessionTerminated`

### ✅ 2.i — Organizer withdraw

- `player_status_changed` con `status === 'withdrawn'` → Alert + `isSessionTerminated = true`

---

## §3 — Sync pull incremental (Phase 7.2.b) — ✅ completado

`GET /api/v1/sync/pull/?since=<ms>` implementado en `SyncEngine`:

- `pull()` → upsert de `players_cache` y `tour_events`; actualiza watermark `last_pull_ms`
- Intervalo de 5 min mientras activo
- Se ejecuta al volver a primer plano (AppState)

---

## Phase 7.2.a + 7.2.b — Bootstrap ≥24h — ✅ completado

- `SyncEngine.bootstrap()`: llama `POST /api/v1/sync/bootstrap/` si >24h desde `last_bootstrap_ms`
- Ejecutado en `start()` y en cada foreground (AppState)

---

## §4 — Limpieza en mobile — ✅ completada

### ✅ 4.a — Tabla `pending_syncs` legacy

- Migración v7 dropea la tabla
- `PendingSync` modelo y funciones de `offline-sync.ts` eliminados

### ✅ 4.b — `GameProvider` legacy

- `providers/GameProvider.tsx` eliminado
- `review.tsx` usa `useCompetition` + `useFreePlay`

### ✅ 4.c — Logs / toasts con tokens españoles

- Grep confirma 0 hits de wire tokens en código activo

### ✅ 4.d — `free-play/waiting-players.tsx` obsoleto

- Eliminado; flujo navega directamente a `/game/scoring`

### ✅ 4.e — `free-play/search-license.tsx` — params legacy

- `groupName` eliminado del type de params y del push de regreso a `setup.tsx`

---

## §5 — Backend-driven scoring mode + leaderboard fallback — ✅ completado

### ✅ 5.a — `effective_scoring_entry_mode`

- `FirebaseCompetitionData` (en `types/game.ts` y `game-service.ts`): campo `effective_scoring_entry_mode?`
- `FoundCompetitionSession.scoringMode` mapeado desde el wire
- `Competition.scoringMode` en `types/game.ts`
- `confirmation.tsx` pasa `scoringMode` al construir `Competition`
- `CompetitionProvider.startCompetition` usa `comp.scoringMode ?? 'all'` en lugar de hardcoded `'all'`

### ✅ 5.b — Leaderboard REST fallback

- `wsClient` emite `max_retries_reached` cuando `reconnectAttempt === 3`
- `wsClient` emite `reconnected` en `onopen` si venía de reconexión
- `CompetitionProvider` escucha `max_retries_reached` → inicia poll `GET /api/v1/scoring/leaderboard/{groupCode}/` cada 15s
- `CompetitionProvider` escucha `reconnected` → detiene el poll

---

---

## mobile-team-todo — Items aplicados (2026-05-26)

Items del fichero `tasks/mobile-team-todo.md` del backend aplicados en esta sesión:

### ✅ S-1 — Bucle de reintento infinito en POST /sync/ con HTTP 400

**Fichero:** `services/sync-engine.ts` — método `sendBatch`

HTTP 400 = rechazo de schema por el backend (error permanente, no transitorio). Se marca el action con `retryCount = MAX_RETRIES` y `nextRetryAt = MAX_SAFE_INTEGER` para sacarlo de la cola de reintentos. Antes, la cola se vaciaba reintenando indefinidamente.

### ✅ §3 — Eliminar pull por intervalo (solo AppState)

**Fichero:** `services/sync-engine.ts`

Eliminados: constante `PULL_INTERVAL_MS`, campo `pullTimer`, `setInterval` en `start()`, `clearInterval` en `stop()`. El pull ahora se dispara únicamente cuando la app vuelve al primer plano vía AppState.

### ✅ §6.a + §6.c — Llamar a `syncEngine.stop()` al terminar la sesión

**Fichero:** `providers/CompetitionProvider.tsx`

Se llama a `syncEngine.stop()` cuando el backend emite `player_status_changed` con `status === 'withdrawn'` o devuelve la sesión a `not_started` tras estar `ready/playing` (device unlinked por el organizador).

### ✅ §6.b — Deshabilitar entrada de puntuación cuando la sesión no está activa

**Fichero:** `app/competition/scoring.tsx`

`canEdit` ahora incluye `isSessionActive` (de `CompetitionProvider`) además de `editMode || !holeSaved`. Si la sesión está terminada (`isSessionTerminated = true`), el input de puntuación queda bloqueado.

---

## §6 — Tests a añadir

- [ ] Integration: WS `score_confirmed` después de sync HTTP 200 → no doble-limpieza de cola
- [ ] Integration: batch de 50 acciones en red inestable → 5 reintentos → backoff `5s → 30s → 2m → 10m`
- [ ] Integration: `action_id` duplicado en dos batches → backend deduplica; mobile marca ambos como synced
- [ ] Device-ID migration: reinstalación genera nuevo UUID → `link-device` reemplaza el hash anterior
- [ ] WS reconnect: `session_uuid` nulo en primer `startCompetition` → WS falla 4404; tras link-device refetch → WS OK
- [ ] `effective_scoring_entry_mode = 'partial'` → `CompetitionProvider.scoringMode === 'partial'` tras startCompetition
- [ ] WS cae 3 veces → leaderboard poll arranca; WS reconecta → poll se detiene

---

## §7 — Cosas que el dashboard web ya hace (awareness móvil)

| Acción organizador | Efecto WS | Respuesta esperada mobile |
|---|---|---|
| Desvincular dispositivo | `player_status_changed` → `not_started` | Alert + stop sync (§2.g ✅) |
| Suspender ronda | `round_finished` | isSessionActive=false (§2.h ✅) |
| Retirar jugador | `player_status_changed` → `withdrawn` | Alert + stop sync (§2.i ✅) |

---

## §9 — Cruce de puntuaciones (scoring cross-reference) — 2026-05-26

### ✅ Mobile — completado

Cada dispositivo registra dos tarjetas: la propia (`scored_by === player_id`) y la del jugador marcado (`scored_by !== player_id`). Al terminar la ronda se cruzan por hoyo.

**Cambios aplicados:**

- `types/game.ts` — `HoleScore.conflictScoreLocal` y `conflictScoreMarker` (opcionales)
- `services/websocket.ts` — `score_confirmed` payload extendido con `round_id`, `hole_number`, `scored_by`, `scores[]` (backward-compatible, todos opcionales)
- `database/models/ActionLog.ts` — `HoleSavedPayload.scores` incluye `scored_by: string`
- `providers/CompetitionProvider.tsx`:
  - Carga inicial rellena `conflictScoreLocal/Marker` desde DB
  - `saveHole`: escribe `conflictScoreLocal` en DB para el jugador del dispositivo; añade `scored_by` al payload HOLE_SAVED
  - Nuevo `useEffect` para `score_confirmed`: escribe `conflictScoreLocal` o `conflictScoreMarker` según `scored_by`
  - Nuevo `amendScore(playerId, holeNumber, agreedScore)`: DB + state + `SCORE_AMENDED` action log
- `app/competition/comprobacion.tsx` — reescrito:
  - Lee `conflictScoreMarker` directamente desde `playerScoresMap.get(currentDevicePlayerId)` (no del marcador)
  - Modal con dos columnas: Marcador | Yo
  - Banner rojo con lista de hoyos en conflicto
  - Edición inline por hoyo → llama a `amendScore`
  - Botón "Firmar" bloqueado mientras haya conflictos sin resolver

### ⬜ Backend pendiente

**Detalle completo:** `backend.todo.md` → sección "Cruce de puntuaciones"

1. `MaterializedScore` — añadir `self_score` y `marker_score`
2. Handler `HOLE_SAVED` — usar `scored_by` para rellenar el campo correcto
3. Evento `score_confirmed` — enriquecer con `{round_id, hole_number, scored_by, scores[]}`
4. Handler `SCORE_AMENDED` — actualizar `MaterializedScore.score` con `new_score`

---

## §8 — Pendientes de backend (2026-05)

### ✅ 8.a — `playing_handicap` y `tee_color` en endpoint de jugadores del grupo

Implementado en backend. `_serialize_competition_player` en `competitions.py` ya recibe un `ScoringSessionPlayer` pre-fetched y devuelve `playing_handicap` (con fallback a `user_license.handicap`) y `tee_color`. El móvil los consume en `code-entry.tsx`.

### ⬜ 8.b — Generar seed de campos de golf

**Detalle completo:** `backend.todo.md` → sección "Generar seed de campos de golf"

`assets/seed/courses.json` está vacío (`[]`). Ejecutar:

```bash
docker compose --project-name grankers --file docker/docker-compose-dev.yml \
  exec -T grankers-app python3 manage.py export_course_seed \
  2>/dev/null > assets/seed/courses.json
```

Tras generar: commit + `bunx expo run:android` para bundlear el JSON.

### ⬜ 8.c — Añadir `group_code` al endpoint upcoming-events

**Prioridad:** Alta — bloquea el auto-load de competición para usuarios inscritos  
**Fichero backend:** `grankers-backend/src/api/v1/views/user.py` — acción `upcoming_events`  
**Detalle completo:** `backend.todo.md` → sección "Añadir group_code al endpoint de upcoming-events"

`GET /api/v1/user/me/upcoming-events/` no incluye `group_code` en la respuesta aunque el dato está disponible vía `TourEventRegistration.tour_event_start_time.group_code`.

**Cambio mínimo en backend:**
```python
# En select_related añadir:
'tour_event_start_time',
# En el dict de respuesta añadir:
'group_code': r.tour_event_start_time.group_code if r.tour_event_start_time else None,
```

**Estado mobile:** `UpcomingEvent.group_code` ya existe en `services/user-service.ts` y el fallback en `code-entry.tsx` ya lo consume. Cero cambios en mobile una vez el backend lo exponga.

---

## Historial de respuestas del backend (2026-04-23)

1. **Routes model** — `Route` es una entidad de primer nivel (scorecard variant por tee + género). `TourEventStartTime` = scheduling. No son sinónimos.

2. **Scoring mode** — `effective_scoring_entry_mode` ya en `GET /competitions/{group_code}/`. `CompetitionProvider.scoringMode` lee este campo. Free-play siempre auto-score.

3. **Leaderboard refresh** — cascade:
   - Cold start → `POST /sync/bootstrap/` (24h guard ✅)
   - WS activo → push `leaderboard_updated` ✅
   - WS caído 3× → REST poll `GET /scoring/leaderboard/<event>/` cada 15s ✅
   - ≥5 min en background → pull `GET /sync/pull/?since=<ts>` ✅
   - ≥24h inactivo → re-bootstrap ✅

4. **Attachment types** — `photo` + `signature` únicamente. `video` y `document` fuera de scope.
