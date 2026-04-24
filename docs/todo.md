# Mobile TODO — Backend Integration

> Generado 2026-04-24 a partir del audit backend+frontend (2026-04-23).  
> Referencia cruzada: backend `tasks/mobile-sync-todo.md` Phase 7.

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

## §1 — Contratos pendientes

### ⬜ 1.a.bis — Route: campos faltantes en schema + modelo

Backend `Route` devuelve `tee_color`, `gender`, `total_distance` (shipping Phase 7.1.a). Mobile no los persiste aún.

**Tareas:**
- [ ] Añadir migración schema v5 → v6: columnas `tee_color` (string, optional), `gender` (string, optional), `total_distance` (number, optional) en tabla `routes`
- [ ] Actualizar `database/models/Route.ts`: añadir `@text('tee_color') teeColor`, `@text('gender') gender`, `@field('total_distance') totalDistance`
- [ ] Actualizar `services/course-service.ts`: leer y persistir los tres campos nuevos desde wire
- [ ] Confirmar que `WireRouteData` en `course-service.ts` incluye los tres campos

### ⬜ 1.b — Route como entidad de primer nivel en creación de sesión

`ScoringSession` tiene `route_uuid`. Las pantallas de free-play ya pasan `routeUuid` al crear la sesión. Verificar que funcione end-to-end cuando backend valida que `route_uuid` pertenece al `course_uuid`.

- [ ] QA: crear partida libre con campo + recorrido → comprobar que el servidor acepta el body y devuelve `route_uuid` en la sesión

### ⬜ 1.c — `competition_name` y `event_name` no llegan en `/active/`

El endpoint `GET /competitions/active/` devuelve `group_code` + `player_id` pero no `competition_name` ni `event_name`. `findCompetitionByDeviceId` encadena una segunda llamada a `/competitions/{group_code}/` para obtenerlos. Si el backend añade esos campos al active endpoint en el futuro, simplificar a una sola llamada.

---

## §2 — Comportamientos de backend a vigilar

### ⬜ 2.b — `score_confirmed` WS — aún no emitido (Phase 7.1.c)

El handler está cableado en backend pero el publisher Celery no está activo aún.

- [ ] Confirmar que `syncEngine` NO bloquea en `score_confirmed` para limpiar la cola
- [ ] `syncedAt = now` en HTTP 200 es correcto — mantenerlo; no atar a WS

### ⬜ 2.e — Clave de canal WS es `rounds.id`, NO `group_code`

- [ ] Auditar la llamada de conexión WS en `CompetitionProvider` y `FreePlayProvider`: debe pasar `ScoringSession.uuid` (= `rounds.id` local), no `group_code`
- [ ] Si hoy se pasa `group_code` → el consumer WS rechaza con 4404

### ⬜ 2.f — Validador regex de `X-Device-ID` en backend

Patrón: `^[a-zA-Z0-9\-]{1,128}$`

- [ ] Confirmar que `crypto.randomUUID()` v4 pasa (36 chars, hex + guiones — ✅)
- [ ] Si se codifica en base64 en algún punto → falla (contiene `=` / `+` / `/`)

### ⬜ 2.g — Organizer-initiated unlink (§6.a del audit)

Organizador puede desvincular un dispositivo desde el dashboard. Efecto: `player_status_changed` con `status = not_started` para el propio jugador.

- [ ] En `CompetitionProvider` y `FreePlayProvider`: detectar `player_status_changed` donde el jugador propio vuelve a `not_started` desde `ready/playing`
- [ ] Mostrar alerta: "Tu dispositivo fue desvinculado. Vuelve a escanear el código de grupo."
- [ ] Detener el envío de nuevas acciones al sync engine para esa ronda

### ⬜ 2.h — Organizer lifecycle changes (§6.b del audit)

Organizador puede suspender/reanudar/forzar-fin desde el dashboard.

- [ ] Asegurar que la pantalla de scoring deshabilita entrada cuando `session.status !== 'in_progress'`
- [ ] Leer `session.status` en cada bootstrap/pull — no requiere cambio de código hoy si se lee en bootstrap

### ⬜ 2.i — Organizer withdraw (§6.c del audit)

- [ ] Cuando `player_status_changed` muestra `status = withdrawn` para el jugador propio: mostrar "Has sido retirado por el organizador" y parar cola de acciones

---

## §3 — Sync pull incremental (Phase 7.2.b)

Backend shipping `GET /api/v1/sync/pull/?since=<ms>`.

- [ ] `services/sync-engine.ts`: llamar al endpoint al volver a primer plano + cada 5 min mientras activo
- [ ] Almacenar watermarks en `app_config`:
  - `last_pull_tour_events_ms`
  - `last_pull_players_cache_ms`
  - `last_pull_rankings_cache_ms`
- [ ] Tablas que se benefician: `tour_events`, `players_cache`, `leaderboard_cache` (warm-start), `rankings_cache`

---

## §4 — Limpieza en mobile

### ⬜ 4.a — Tabla `pending_sync` legacy

Listada como "Legacy, en revisión" en el schema.

- [ ] Fijar fecha de deprecación
- [ ] Añadir migración para dropearla (schema v6 o v7)
- [ ] No hay dependencia backend

### ⬜ 4.b — `GameProvider` legacy

Listado como "en proceso de eliminación".

- [ ] Eliminar `providers/GameProvider.tsx`
- [ ] Eliminar referencias en `_layout.tsx`

### ⬜ 4.c — Logs / toasts con tokens españoles

- [ ] Grep de `codigo_grupo`, `nombre_competicion`, `apellido` fuera de la capa de transformación
- [ ] Sustituir en mensajes de error, toasts y breadcrumbs de Sentry

### ⬜ 4.d — `free-play/waiting-players.tsx` obsoleto

Con el modelo flat, el flujo de free-play navega directamente a `/game/scoring`. La pantalla de espera ya no es parte del flujo principal.

- [ ] Evaluar si se elimina o se repropósita (podría usarse para mostrar estado de la sesión)

### ⬜ 4.e — `free-play/search-license.tsx` — verificar params actualizados

La pantalla recibe params de `setup.tsx`. Confirmar que ya no recibe `groupName` y que los nuevos `courseUuid`/`routeUuid` llegan correctamente si los necesita.

---

## §5 — Tests a añadir

- [ ] Integration: WS `score_confirmed` después de sync HTTP 200 → no doble-limpieza de cola (cuando Phase 7.1.c ship)
- [ ] Integration: batch de 50 acciones en red inestable → 5 reintentos → backoff `5s → 30s → 2m → 10m` (spec §Sync Engine)
- [ ] Integration: `action_id` duplicado en dos batches (escenario de crash recovery) → backend deduplica; mobile marca ambos como synced
- [ ] Device-ID migration: reinstalación genera nuevo UUID → `link-device` reemplaza el hash anterior

---

## §6 — Cosas que el dashboard web ya hace (awareness móvil)

No requieren endpoints nuevos, pero la app debe manejar los cambios de estado resultantes:

| Acción organizador | Efecto WS | Respuesta esperada mobile |
|---|---|---|
| Desvincular dispositivo | `player_status_changed` → `not_started` | Alerta + stop sync (§2.g) |
| Suspender ronda | `score_confirmed` server-originated | Deshabilitar entrada de scores (§2.h) |
| Retirar jugador | `player_status_changed` → `withdrawn` | Alerta + stop sync (§2.i) |

---

## Historial de respuestas del backend (2026-04-23)

1. **Routes model** — `Route` es una entidad de primer nivel (scorecard variant por tee + género). `TourEventStartTime` = scheduling (tee times, códigos de grupo). No son sinónimos. Docs móviles deben dejar de usar `recorrido` como sinónimo de `Route`.

2. **Scoring mode** — `effective_scoring_entry_mode` ya en `GET /competitions/{group_code}/` (Phase 7.1.a). `CompetitionProvider.scoringMode` debe leer este campo en lugar de calcularlo localmente. Free-play siempre auto-score.

3. **Leaderboard refresh** — cascade de tres niveles:
   - Cold start → `POST /sync/bootstrap/`
   - WS activo → push `leaderboard_updated`
   - WS caído 3× → REST poll `GET /scoring/leaderboard/<event>/` cada 15s
   - ≥5 min en background → pull `GET /sync/pull/?since=<ts>` (Phase 7.2.b pending)
   - ≥24h inactivo → re-bootstrap

4. **Attachment types** — `photo` + `signature` únicamente. `video` y `document` fuera de scope. Backend tightening validator a `{photo, signature}`.
