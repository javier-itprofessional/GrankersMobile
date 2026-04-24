# Mobile TODO — Backend Integration

> Actualizado 2026-04-24.  
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
| §2.g | Organizer unlink → `not_started` | ✅ backend emite | ⬜ mobile handler | Alert + stop sync |
| §2.h | Organizer lifecycle (suspend/resume/force-end) | ✅ backend emite | ⬜ mobile handler | Deshabilitar entrada |
| §2.i | Organizer withdraw → `withdrawn` | ✅ backend emite | ⬜ mobile handler | Alert + stop sync |
| §3 | Sync pull incremental `GET /sync/pull/?since=` | ✅ shipped 7.2.b | ⬜ open | sync-engine.ts + watermarks |
| Phase 7.2.a | Bootstrap leaderboards en /sync/bootstrap/ | ✅ shipped | ✅ done | — |
| Phase 7.2.c | `avatar_url` real en /players/search/ | ✅ shipped | ✅ **done** | `SearchResultCard` muestra imagen |
| §4.a | Tabla `pending_syncs` legacy | — | ⬜ open | Deprecar + drop en schema v7 |
| §4.b | `GameProvider` legacy | — | ⬜ open | Eliminar providers/GameProvider.tsx |
| §4.c | Logs/toasts con tokens españoles | — | ⬜ open | Grep + sustituir |
| §4.d | `free-play/waiting-players.tsx` obsoleto | — | ⬜ open | Evaluar eliminación |

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

### ⬜ 2.f — Validador regex de `X-Device-ID` en backend

- `crypto.randomUUID()` v4 pasa (36 chars, hex + guiones ✅)

### ⬜ 2.g — Organizer-initiated unlink

- [ ] En `CompetitionProvider` y `FreePlayProvider`: detectar `player_status_changed` donde el jugador propio vuelve a `not_started` desde `ready/playing`
- [ ] Mostrar alerta: "Tu dispositivo fue desvinculado. Vuelve a escanear el código de grupo."
- [ ] Detener envío de nuevas acciones al sync engine

### ⬜ 2.h — Organizer lifecycle changes

- [ ] Deshabilitar entrada cuando `session.status !== 'in_progress'`
- [ ] Leer `session.status` en bootstrap/pull

### ⬜ 2.i — Organizer withdraw

- [ ] Cuando `player_status_changed` muestra `status = withdrawn` para el jugador propio: alerta + stop cola

---

## §3 — Sync pull incremental (Phase 7.2.b) — backend shipped

Backend ya serve `GET /api/v1/sync/pull/?since=<ms>`.

- [ ] `services/sync-engine.ts`: llamar al endpoint al volver a primer plano + cada 5 min mientras activo
- [ ] Almacenar watermarks en `app_config`:
  - `last_pull_tour_events_ms`
  - `last_pull_players_cache_ms`
  - `last_pull_rankings_cache_ms`
- [ ] Tablas que se benefician: `tour_events`, `players_cache`, `leaderboard_cache` (warm-start), `rankings_cache`

---

## §4 — Limpieza en mobile

### ⬜ 4.a — Tabla `pending_syncs` legacy

- [ ] Añadir migración para dropearla (schema v7)
- [ ] No hay dependencia backend

### ⬜ 4.b — `GameProvider` legacy

- [ ] Eliminar `providers/GameProvider.tsx`
- [ ] Eliminar referencias en `_layout.tsx`

### ⬜ 4.c — Logs / toasts con tokens españoles

- [ ] Grep de `codigo_grupo`, `nombre_competicion`, `apellido` fuera de la capa de transformación
- [ ] Sustituir en mensajes de error, toasts y breadcrumbs de Sentry

### ⬜ 4.d — `free-play/waiting-players.tsx` obsoleto

Con el modelo flat, el flujo navega directamente a `/game/scoring`.

- [ ] Evaluar si se elimina o se repropósita

### ⬜ 4.e — `free-play/search-license.tsx` — params legacy

La pantalla todavía pasa/recibe `groupName`. Confirmar que se puede eliminar.

---

## §5 — Tests a añadir

- [ ] Integration: WS `score_confirmed` después de sync HTTP 200 → no doble-limpieza de cola
- [ ] Integration: batch de 50 acciones en red inestable → 5 reintentos → backoff `5s → 30s → 2m → 10m`
- [ ] Integration: `action_id` duplicado en dos batches → backend deduplica; mobile marca ambos como synced
- [ ] Device-ID migration: reinstalación genera nuevo UUID → `link-device` reemplaza el hash anterior
- [ ] WS reconnect: `session_uuid` nulo en primer `startCompetition` → WS falla 4404; tras link-device refetch → WS OK

---

## §6 — Cosas que el dashboard web ya hace (awareness móvil)

| Acción organizador | Efecto WS | Respuesta esperada mobile |
|---|---|---|
| Desvincular dispositivo | `player_status_changed` → `not_started` | Alerta + stop sync (§2.g) |
| Suspender ronda | `score_confirmed` server-originated | Deshabilitar entrada de scores (§2.h) |
| Retirar jugador | `player_status_changed` → `withdrawn` | Alerta + stop sync (§2.i) |

---

## Historial de respuestas del backend (2026-04-23)

1. **Routes model** — `Route` es una entidad de primer nivel (scorecard variant por tee + género). `TourEventStartTime` = scheduling. No son sinónimos.

2. **Scoring mode** — `effective_scoring_entry_mode` ya en `GET /competitions/{group_code}/`. `CompetitionProvider.scoringMode` debe leer este campo. Free-play siempre auto-score.

3. **Leaderboard refresh** — cascade:
   - Cold start → `POST /sync/bootstrap/`
   - WS activo → push `leaderboard_updated`
   - WS caído 3× → REST poll `GET /scoring/leaderboard/<event>/` cada 15s
   - ≥5 min en background → pull `GET /sync/pull/?since=<ts>` (§3 pending)
   - ≥24h inactivo → re-bootstrap

4. **Attachment types** — `photo` + `signature` únicamente. `video` y `document` fuera de scope.
