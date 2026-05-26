# Backend TODOs para GrankersMobile

## [HECHO] Exponer playing_handicap y tee_color en el endpoint de jugadores del grupo

> Implementado en backend. `_serialize_competition_player` en `api/v1/views/competitions.py` ya acepta un `ScoringSessionPlayer` pre-fetched y devuelve `playing_handicap` y `tee_color` con fallback a `user_license.handicap`. El móvil ya consume estos campos correctamente.

**Prioridad:** Alta  
**Afecta a:** Pantalla de competición — modo de entrada al grupo antes de jugar

### Contexto

`GET /api/v1/competitions/{group_code}/` devuelve los jugadores del grupo, pero la función `_serialize_competition_player` en `api/v1/views/competitions.py` solo incluye `id`, `first_name`, `last_name` y `license`. No incluye ni el handicap ni el tee del jugador.

El móvil necesita mostrar en la pantalla de competición (antes de pulsar "Listo"):
- **El `playing_handicap` del jugador** — campo `playing_handicap` de `scoring.ScoringSessionPlayer` si ya existe para ese jugador en la sesión, o `user_license.handicap` de `TourEventRegistration` como fallback.
- **El `tee_color` del jugador** — campo `tee_color` de `scoring.ScoringSessionPlayer` si existe, o de la `TourCategory` asignada a su categoría de inscripción.

### Qué hay que cambiar en el backend

**Fichero:** `grankers-backend/src/api/v1/views/competitions.py`

Función `_serialize_competition_player(registration)` — añadir los campos:

```python
def _serialize_competition_player(registration, session=None) -> dict:
    user = registration.user

    # Obtener playing_handicap y tee_color desde ScoringSessionPlayer si existe
    playing_handicap = None
    tee_color = None
    if session:
        try:
            ssp = ScoringSessionPlayer.objects.get(session=session, player=user)
            playing_handicap = ssp.playing_handicap
            tee_color = ssp.tee_color
        except ScoringSessionPlayer.DoesNotExist:
            pass

    # Fallback: handicap desde la licencia en el momento de inscripción
    if playing_handicap is None and registration.user_license_id:
        hcp = registration.user_license.handicap
        playing_handicap = float(hcp) if hcp is not None else None

    return {
        'id': str(user.uuid),
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'license': (
            registration.user_license.license_number
            if registration.user_license_id else None
        ),
        'playing_handicap': playing_handicap,   # NUEVO
        'tee_color': tee_color,                 # NUEVO
    }
```

En `CompetitionDetailView.get()` pasar la sesión al serializer:

```python
'players': [_serialize_competition_player(r, session=session) for r in registrations],
```

### Qué espera recibir el móvil

El tipo `FirebaseCompetitionData` en `types/game.ts` ya tiene `handicap?: number` en cada jugador. Solo falta que el backend lo rellene.

Tras el cambio, añadir también `tee_color?: string` al tipo para poder mostrarlo.

### Impacto

Sin este cambio, el móvil muestra el handicap WHS del perfil del jugador como aproximación (el handicap actual de su licencia, no el playing_handicap ajustado al campo). Una vez implementado el cambio, se usará el dato correcto automáticamente ya que el campo `handicap` en la respuesta se mapea en `game-service.ts`.

---

## [PENDIENTE] Generar seed de campos de golf

**Prioridad:** Alta  
**Motivo:** La app incluye `assets/seed/courses.json` vacío (`[]`). Hasta que se rellene con datos reales, los usuarios no verán campos al abrir la app por primera vez (antes del primer login).

### Qué hay que hacer

Ejecutar el management command de Django que exporta todos los cursos, recorridos y hoyos al formato JSON que usa la app:

```bash
docker compose --project-name grankers --file docker/docker-compose-dev.yml \
  exec -T grankers-app python3 manage.py export_course_seed \
  2>/dev/null > assets/seed/courses.json
```

Ejecutar desde la raíz de `GrankersMobile/` con Docker corriendo.

### El management command

El comando ya está escrito en el backend:

**Fichero:** `grankers-backend/src/club/management/commands/export_course_seed.py`

Exporta todos los `Course` con sus `Route` y `Hole` en el mismo formato que `GET /api/v1/courses/` — reusando `serialize_route()` de la vista existente. El output va a stdout (limpio para redirección), el mensaje de éxito a stderr.

### Después de generarlo

1. Verificar que `assets/seed/courses.json` no está vacío y tiene la estructura correcta:
   ```json
   [{ "id": "...", "name": "...", "city": "...", "country": "...", "routes": [...] }]
   ```
2. Hacer commit del fichero en GrankersMobile:
   ```bash
   git add assets/seed/courses.json
   git commit -m "seed: poblar catálogo inicial de campos de golf"
   ```
3. Rebuild del native app para que el JSON quede bundleado:
   ```bash
   bunx expo run:android
   ```

### Por qué es necesario

La app carga el catálogo de campos desde memoria (in-memory Map) populado síncronamente al arrancar desde el seed JSON. Esto garantiza respuesta instantánea en la UI de selección de campo. Sin seed, el catálogo aparece vacío hasta que el usuario hace login y el refresh asíncrono termina.

Con seed populado: tiempo de carga del selector de campos = 0ms (memoria).  
Sin seed: el selector espera al refresh de red (~1-2s con buena conexión, inaceptable offline).

---

## [PENDIENTE] Añadir group_code al endpoint de upcoming-events

**Prioridad:** Alta  
**Afecta a:** Pantalla de competición — auto-carga para usuarios inscritos sin necesidad de introducir código manualmente

### Contexto

`GET /api/v1/user/me/upcoming-events/` (acción `upcoming_events` en `api/v1/views/user.py`) devuelve las inscripciones del usuario pero **no incluye `group_code`** en la respuesta, aunque el dato está disponible: `TourEventRegistration` tiene un FK `tour_event_start_time → TourEventStartTime.group_code`.

El móvil necesita este campo para cargar automáticamente la competición del día sin que el usuario tenga que introducir el código de grupo manualmente.

### Qué hay que cambiar en el backend

**Fichero:** `grankers-backend/src/api/v1/views/user.py` — acción `upcoming_events` (~línea 406)

**Cambio 1** — añadir `tour_event_start_time` al `select_related`:

```python
.select_related(
    'event', 'event__tour', 'event__golf_club',
    'fee_tier', 'team_registration',
    'tour_event_start_time',   # ← AÑADIR
)
```

**Cambio 2** — añadir `group_code` al dict de respuesta:

```python
'group_code': r.tour_event_start_time.group_code if r.tour_event_start_time else None,
```

### Qué espera recibir el móvil

La interfaz `UpcomingEvent` en `services/user-service.ts` ya tiene `group_code: string | null`. La lógica de auto-carga en `app/competition/code-entry.tsx` ya usa `todayEvent.group_code` como fallback de la estrategia 3. En cuanto el backend devuelva el campo, funciona sin cambios adicionales en el móvil.

### Flujo completo una vez implementado

1. Al abrir la pantalla de competición el móvil detecta `todayEvent` (inscripción de hoy)
2. Intenta carga por device link (sesión previa) → si falla:
3. Usa `todayEvent.group_code` para llamar a `GET /competitions/{group_code}/` → obtiene datos completos
4. Muestra pantalla con info de evento + campo + handicap + grupo
5. El usuario solo pulsa "Estoy listo" — **nunca introduce código manualmente**

---

## [PENDIENTE] Cruce de puntuaciones (scoring cross-reference)

**Prioridad:** Alta  
**Afecta a:** Sincronización y verificación de tarjetas — pantalla de comprobación al finalizar la ronda

### Contexto

En competición, cada jugador apunta dos tarjetas: la suya propia y la del jugador que está marcando (asignación circular). Al final de la ronda se cruzan ambas para detectar discrepancias hoyo a hoyo.

El móvil ya envía `HOLE_SAVED` al endpoint `POST /api/v1/sync/` con el campo `scored_by` por cada score:

```json
{
  "action_type": "HOLE_SAVED",
  "payload": {
    "round_id": "...",
    "hole_number": 7,
    "scores": [
      { "player_id": "uuid-A", "score": 5, "scored_by": "uuid-A" },
      { "player_id": "uuid-B", "score": 4, "scored_by": "uuid-A" }
    ]
  }
}
```

- `scored_by === player_id` → el jugador apuntó su propia puntuación (self-score)
- `scored_by !== player_id` → el jugador apuntó la puntuación del jugador que está marcando (marker-score)

### Qué hay que cambiar en el backend

#### 1. Modelo `MaterializedScore` — añadir campos de cruce

En el modelo existente (`scoring.MaterializedScore` o equivalente), añadir:

```python
self_score = models.IntegerField(null=True, blank=True)     # golpes apuntados por el propio jugador
marker_score = models.IntegerField(null=True, blank=True)   # golpes apuntados por su marcador
```

#### 2. Handler de `HOLE_SAVED` — distinguir self vs marker

En el handler que procesa la acción `HOLE_SAVED`, usar `scored_by` para saber qué campo actualizar:

```python
for score_entry in payload['scores']:
    player_id = score_entry['player_id']
    score_val = score_entry['score']
    scored_by = score_entry['scored_by']

    mat_score, _ = MaterializedScore.objects.get_or_create(
        round=round_obj, player_id=player_id, hole_number=payload['hole_number']
    )
    if scored_by == player_id:
        mat_score.self_score = score_val
    else:
        mat_score.marker_score = score_val
    # Score oficial = el que tenga datos (se usará self_score hasta que haya discrepancia resuelta)
    mat_score.score = score_val
    mat_score.save()
```

#### 3. Evento WebSocket `score_confirmed` — enriquecer con datos de cruce

El backend ya emite `score_confirmed` con `{action_id, materialized}`. Hay que añadir los campos:

```python
{
    "type": "score_confirmed",
    "payload": {
        "action_id": "...",
        "materialized": True,
        # NUEVO — enviados cuando scored_by != player_id (marker registró el score)
        "round_id": "...",
        "hole_number": 7,
        "scored_by": "uuid-A",
        "scores": [
            { "player_id": "uuid-A", "score": 5 },
            { "player_id": "uuid-B", "score": 4 }
        ]
    }
}
```

Enviar estos campos **siempre** (no solo cuando scored_by != player_id) para que cada dispositivo pueda actualizar `conflictScoreLocal` o `conflictScoreMarker` según corresponda.

### Qué hace el móvil con esto (ya implementado)

Cuando recibe `score_confirmed` con los campos enriquecidos:

- Si `scored_by === player_id` en una entry → escribe `conflictScoreLocal` en `hole_scores`
- Si `scored_by !== player_id` → escribe `conflictScoreMarker` en `hole_scores`
- La pantalla `comprobacion.tsx` lee ambos campos por hoyo y resalta los que difieren
- El jugador puede enmendar la puntuación acordada → genera `SCORE_AMENDED` en el log de acciones

### Handler de `SCORE_AMENDED`

```json
{
  "action_type": "SCORE_AMENDED",
  "payload": {
    "round_id": "...",
    "player_id": "uuid-A",
    "hole_number": 7,
    "old_score": 5,
    "new_score": 4,
    "reason": "Acuerdo entre jugadores"
  }
}
```

El backend debe actualizar `MaterializedScore.score` con `new_score` y registrar el cambio en el log de auditoría.

### Impacto

Sin estos cambios, `conflictScoreMarker` en el móvil nunca se rellena (el WS solo devuelve `{action_id, materialized}`), por lo que la pantalla de comprobación siempre muestra "—" en la columna del marcador y el cruce de puntuaciones no funciona.
