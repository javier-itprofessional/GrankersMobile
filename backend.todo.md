# Backend TODOs para GrankersMobile

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
