# TASK-05 — Listado con filtros, búsqueda y paginación en la API, y rendimiento

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
`GET /api/jobs` admite `status`, `q`, `page` y `pageSize`, combinados en Y, con el orden y la forma de HU-01 y `total`
del resultado filtrado:
- Plegado de texto compartido (`foldSearchText`) y función SQL determinista `fold_search`, registrada en la conexión
  desde la factoría del repositorio (DD-04). HU-03 la reutilizará.
- Esquema de la querystring como texto con `pattern` (DEC-11.2) y `q` recortado antes de validar (DD-05).
- Repositorio, servicio y ruta del listado filtrado.
- Tests del camino feliz y de las fronteras (`list-filters.test.ts`) y el cambio del test EC-34 de HU-01 en
  `list.test.ts`.
- Presupuestos de rendimiento de HU-02 (RNF-01, RNF-02) para todas las rutas nuevas y cambiadas.

Los parámetros inválidos (CA-19 a CA-21, EC-32, EC-33), la inyección y los logs (EC-39, RNF-06) los prueba la tarea
`[adversarial]` TASK-06; el esquema que los rechaza se implementa aquí.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/db/text-search.ts` | crear | `foldSearchText(text)` y `registerTextSearch(db)` (~30 líneas) |
| `apps/api/src/modules/jobs/schemas.ts` | modificar | `listQuerySchema` con 4 parámetros; tipos `JobListQuery` y `JobListQuerystring`; `DEFAULT_PAGE`, `DEFAULT_PAGE_SIZE` |
| `apps/api/src/modules/jobs/repository.ts` | modificar | `listPage(filter, limit, offset)`, `count(filter)`; `registerTextSearch(db)` en `createJobsRepository` |
| `apps/api/src/modules/jobs/service.ts` | modificar | `list(query)` |
| `apps/api/src/modules/jobs/routes.ts` | modificar | `trimSearchText` (`preValidation`) y `toListQuery` en `GET /` |
| `apps/api/test/db/text-search.test.ts` | crear | `foldSearchText` |
| `apps/api/test/jobs/list-filters.test.ts` | crear | Filtros, búsqueda y paginación (camino feliz y fronteras) |
| `apps/api/test/jobs/list.test.ts` | modificar | EC-34 de HU-01 (líneas 94-110) |
| `apps/api/test/jobs/performance.test.ts` | modificar | RNF-01 y RNF-02 de HU-02 |

## Implementa
- RF: RF-05 (API) · RNF: RNF-01, RNF-02 · CA: CA-16, CA-17 · Edge cases: EC-34, EC-35, EC-37, EC-38, EC-48
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API › Esquemas nuevos y tabla de mensajes de la querystring,
  § Endpoints (`GET /api/jobs`), § Firmas internas (`text-search.ts`, repositorio), consulta del listado, § Diagrama de
  secuencia RF-05, DD-04, DD-05, § Estrategia de tests (filas RF-05, RNF-01, RNF-02), § Tests de HU-01 que cambian,
  § Checklist pasos 7 y 9

## Dependencias
- **Depende de:** TASK-03 (comparten `schemas.ts`, `repository.ts`, `service.ts` y `routes.ts`; y el rendimiento mide
  las rutas de TASK-02 y el `PATCH`/`DELETE` de TASK-03)
- **Bloquea:** TASK-06, TASK-08, TASK-14

## Criterios de done
- [ ] CA-16: con «Responsable de gestión de nóminas» y «GESTIÓN de proveedores» (`published`), «Técnico/a de gestión
      administrativa» (`draft`), «Analista de datos junior» (`published`) y una `closed` con «Gestión» →
      `?status=published&q=gestion` devuelve solo las dos publicadas con «gestión», en el orden del listado, `total` 2.
- [ ] CA-17/EC-34: con 25 ofertas, `page=2` → 5 en el mismo orden y `total` 25; `pageSize=100` → 25; `page=3` →
      `items: []` y `total` 25; con 20 ofertas `page=2` vacía; con 21, dos páginas; `pageSize` 1 y 100 válidos.
- [ ] EC-35: «gestion» y «GESTIÓN» encuentran «Responsable de gestión de nóminas»; «ano» encuentra «Becario/a de año en
      prácticas»; `q` vacío o de espacios = sin filtro.
- [ ] EC-38: un título guardado en NFD (`'Gestión'.normalize('NFD')`) lo encuentran «gestion» y «gestión».
- [ ] EC-48: `q=Pena` encuentra «Monitor/a de la peña deportiva» y «Técnico/a de penalizaciones aduaneras».
- [ ] EC-37: publicar una oferta entre la página 1 y la 2 desplaza el orden (aceptado, DEC-10).
- [ ] `list.test.ts`: «EC-34 (HU-01) parámetro desconocido → 400» con `?sort=title` y `?foo=1` («Campo no permitido.»).
- [ ] RNF-01: listado con filtros y `pageSize=100`, `GET /:id` y `close-preview` < 200 ms con 100 ofertas. RNF-02:
      publicar, cerrar, duplicar, `PATCH` y `DELETE` < 500 ms con 100 ofertas.
- [ ] `npm test -w apps/api -- list text-search performance` en verde, con **4** ficheros de test ejecutados (`list`
      recoge `list.test.ts` y `list-filters.test.ts`).
- [ ] `npm test -w apps/api` completo en verde (`seed.test.ts` sigue en verde: `fold_search` se registra en cada
      conexión).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/db/text-search.ts apps/api/src/modules/jobs apps/api/test/db/text-search.test.ts apps/api/test/jobs/list.test.ts apps/api/test/jobs/list-filters.test.ts apps/api/test/jobs/performance.test.ts`
      sin errores.
- [ ] Commit único `feat(jobs): list filters, accent-insensitive search and pagination [HU-02 TASK-05]` nombrando los
      ficheros.

## Notas de implementación

**Esquema** (`schemas.ts`; `NO_CONTROL_CHARS` de `http/validation.ts`):

```json
"ListQuery": { "type": "object", "additionalProperties": false, "properties": {
  "status":   { "type": "string", "enum": ["draft", "published", "closed"] },
  "q":        { "type": "string", "maxLength": 100, "pattern": NO_CONTROL_CHARS },
  "page":     { "type": "string", "pattern": "^[1-9][0-9]{0,8}$" },
  "pageSize": { "type": "string", "pattern": "^(?:[1-9][0-9]?|100)$" } } }
```

| Entrada | `details` (lo prueba TASK-06) |
|---|---|
| `status=Published`, `status=` o `status=archived` | `status`: «Debe ser uno de estos valores: draft, published, closed.» |
| `status=draft&status=closed` (llega como *array*) | `status`: «Debe ser un texto.» |
| `page=0`, `-1`, `1.5`, `abc`, `007` o `page=` | `page`: «Formato no válido.» |
| `pageSize=0`, `101`, `abc` o `007` | `pageSize`: «Formato no válido.» |
| `q` de 101 puntos de código tras recortar | `q`: «Debe tener como máximo 100 caracteres.» |
| `q` con C0 o DEL **dentro** del texto | `q`: «Formato no válido.» |
| `sort=title` o cualquier otro parámetro | `sort`: «Campo no permitido.» |

- `JobListQuery = { status?: JobStatus; q?: string; page: number; pageSize: number }`; `DEFAULT_PAGE = 1`,
  `DEFAULT_PAGE_SIZE = 20`. `Job`, `JobListItem` y `JobPage` no cambian.

**Ruta:** `GET /` con `preValidation: trimSearchText` (`trimTextFields(request.query, { trim: ['q'], emptyToNull: [] })`)
y `schema: { querystring: listQuerySchema, response: { 200: jobPageSchema } }`; `toListQuery` convierte `page` y
`pageSize` con `Number()` (por defecto 1 y 20) y pasa `q` vacío como ausente. Un tabulador o salto de línea en el
**borde** de `q` se recorta (DD-05).

**Plegado** (DD-04, sin dependencias, DEC-05):

```ts
// apps/api/src/db/text-search.ts
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
export function registerTextSearch(db: DatabaseSync): void {
  db.function('fold_search', { deterministic: true }, (value) =>
    typeof value === 'string' ? foldSearchText(value) : value);
}
```

- `registerTextSearch(db)` dentro de `createJobsRepository(db)` (registrarla dos veces en la misma conexión no falla).
  Una conexión sin ella daría 500 «no such function».

**Servicio:** `list(query)` → `filter = { status: query.status ?? null, q: query.q ? foldSearchText(query.q) : null }`;
`items = repository.listPage(filter, pageSize, (page - 1) * pageSize)`; `total = repository.count(filter)`; devuelve
`{ items, total, page, pageSize }`.

**Repositorio** (una sentencia fija con parámetros con nombre; `COUNT(*)` con el mismo `WHERE`):

```sql
SELECT id, title, status, COALESCE(published_at, created_at) AS reference_date
  FROM job_openings
 WHERE (:status IS NULL OR status = :status)
   AND (:q IS NULL OR instr(fold_search(title), :q) > 0)
 ORDER BY COALESCE(published_at, created_at) DESC, id DESC
 LIMIT :limit OFFSET :offset
```

- `instr` es literal: `%`, `_` y `\` no son comodines. Nunca se concatena la entrada al SQL.
- `interface JobListFilter { status: JobStatus | null; q: string | null }` (q ya plegado).

**Tests** (nombres del TD):
- `apps/api/test/db/text-search.test.ts`: «foldSearchText: minúsculas, sin tildes, ñ → n, entrada en NFD».
- `list-filters.test.ts`: «CA-16 published + gestion → 2 en orden, total 2», «CA-17/EC-34 fronteras de página (20/21,
  pageSize 1 y 100, más allá de la última)», «EC-35 sin mayúsculas ni tildes; q vacío = sin filtro», «EC-37 publicar
  entre páginas desplaza el orden (aceptado)», «EC-38 título guardado en NFD», «EC-48 q=Pena encuentra peña y
  penalizaciones (consecuencia aceptada de DT-05)». Crea las ofertas con `createJob` y escalona el reloj para fijar el
  orden. En la URL de `inject`, codifica `q` con `encodeURIComponent`.
- `performance.test.ts`: «RNF-01 listado con filtros y pageSize=100, ficha y close-preview < 200 ms con 100 ofertas» y
  «RNF-02 publicar, cerrar, duplicar, PATCH y DELETE < 500 ms con 100 ofertas» (calentamiento previo y
  `performance.now()`, como los de HU-01).

## Reapertura · review ronda 1 (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, `VERDICT: Requiere cambios`), §9.
- **Qué hay que hacer:** Bajo de la review: `apps/api/test/jobs/performance.test.ts` tiene dos tests casi homónimos de RNF-02 (el de HU-01 «RNF-02 POST, PATCH y DELETE…» y el nuevo de HU-02). Quita el duplicado conservando la medición de `POST /api/jobs` (del alta) dentro del test de HU-02, para no perder cobertura.
- **Ficheros:** `apps/api/test/jobs/performance.test.ts`
- **Criterios de done:** `npm test -w @ats/api -- performance` en verde; `npm run typecheck -w @ats/api`; `npx eslint` del fichero; ninguna medición de RNF-01 ni RNF-02 se pierde (lista cuáles quedan).
