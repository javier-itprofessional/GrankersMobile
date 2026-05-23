# Backend TODOs para GrankersMobile

## [PENDIENTE] Exponer playing_handicap y tee_color en el endpoint de jugadores del grupo

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
