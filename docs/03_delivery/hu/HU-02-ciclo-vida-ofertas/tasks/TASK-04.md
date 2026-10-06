# TASK-04 — Publicar, cerrar y duplicar en la API frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** test (backend)
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Tarea `[adversarial]` de la API para **RF-01, RF-02 y RF-04**: casos hostiles y de fallo sobre las rutas de TASK-02,
recorriendo las categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3. Solo añade tests; si uno destapa un
fallo en `service.ts` o `routes.ts`, se arregla aquí (techo de 2 ciclos) y, si es de diseño, se para y se escala.

| RF | Categoría · edge cases |
|---|---|
| RF-01 Publicar | 1 EC-01 (ID no válido, cuerpo), EC-02/CA-03 (campos pendientes) · 3 EC-05 (fallo de SQLite) · 4 EC-06 (borrada antes) · 6 EC-08 (404 sin datos), EC-49 · E2 CA-04 (409) |
| RF-02 Cerrar | 1 EC-10 · 3 EC-12/CA-09 (fallo del puerto y de SQLite) · 6 EC-15 (500 sin *stack*), EC-49 · E1 CA-08 (409) · DT-01 (previa 404/400) |
| RF-04 Duplicar | 1 EC-25 · 3 EC-27 · 6 EC-30 (HTML literal), EC-49 |

Las demás categorías (2 boundary, 4 concurrencia benigna, 5 datos antiguos, 7 idempotencia) están en TASK-02 o son
N/A (EC-14, EC-29) según la tabla del ROADMAP.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/publish.test.ts` | modificar | + EC-01, CA-03/EC-02, CA-04, EC-05, EC-06, EC-08 |
| `apps/api/test/jobs/close.test.ts` | modificar | + EC-10, CA-08, CA-09/EC-12 (×2), DT-01 |
| `apps/api/test/jobs/duplicate.test.ts` | modificar | + EC-25, EC-27, EC-30 |
| `apps/api/test/http/cross-site.test.ts` | modificar | + `POST /:id/publish`, `/:id/close` y `/:id/duplicate` en los `it.each` de EC-49 |

Si alguno de los tres ficheros de acciones fuera a pasar de 300 líneas, los casos de esta tarea van a un hermano
`apps/api/test/jobs/<acción>-adversarial.test.ts` (crear: `publish-`, `close-` o `duplicate-adversarial`); el patrón de
abajo los recoge igual.

## Implementa
- RF: RF-01, RF-02, RF-04 (API) · RNF: RNF-03 · CA: CA-03, CA-04, CA-08, CA-09 · Edge cases: EC-01, EC-02, EC-05,
  EC-06, EC-08, EC-10, EC-12, EC-15 (API), EC-25, EC-27, EC-30, EC-49 (rutas nuevas)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (convenciones, tabla de errores, orden de comprobación),
  § Error paths (EC-01 a EC-15, EC-25 a EC-31, EC-49), DD-01, DD-06, § Estrategia de tests (filas `[adversarial]` de
  RF-01, RF-02 y RF-04)

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** nada (puede ir en paralelo con TASK-03 y TASK-05: no comparten ficheros)

## Criterios de done
- [ ] EC-01: `POST /api/jobs/abc/publish` → 400 en `id`; con cuerpo `{ "status": "closed" }` → 400 con
      `details: [{ field: "body", message: "Esta acción no admite cuerpo." }]`; sigue en `draft`.
- [ ] CA-03/EC-02: borrador sin descripción ni modalidad → 400 con `description` y `workMode` en `details`; con solo el
      título → `description`, `location` y `workMode`, en ese orden, «Obligatorio para publicar.» (la banda nunca);
      sigue `draft` y `publishedAt` nulo.
- [ ] CA-04: publicar una `closed` → 409 «Una oferta cerrada no se puede publicar.»; estado y fechas iguales.
- [ ] EC-05: `failWrites(db, 'UPDATE')` al publicar → 500 `INTERNAL_ERROR` en el envelope exacto, sin *stack*; sigue
      `draft` sin `publishedAt`.
- [ ] EC-06/EC-08: publicar una oferta borrada e IDs inexistentes → 404 con el cuerpo exacto
      `{ "error": { "code": "NOT_FOUND", "message": "La oferta no existe." } }` (sin ID ni datos).
- [ ] EC-10: `POST /api/jobs/1.5/close` → 400; con cuerpo → 400 en `body`; sigue `published`.
- [ ] CA-08: cerrar un borrador → 409 «Un borrador no se puede cerrar: publícalo primero.»; sigue `draft`.
- [ ] CA-09/EC-12/EC-15: con `createApplicationsSpy({ failOnReject: true })` → 500 `INTERNAL_ERROR` con el envelope
      exacto y sin *stack*; sigue `published` y `closedAt` nulo. Con `failWrites(db, 'UPDATE')` → igual.
- [ ] DT-01: `GET /api/jobs/999999/close-preview` → 404; `/api/jobs/abc/close-preview` → 400.
- [ ] EC-25: duplicar `/api/jobs/abc` → 400; un ID inexistente → 404; el número de filas no cambia.
- [ ] EC-27: `failWrites(db, 'INSERT')` al duplicar → 500; sin filas nuevas; la original igual.
- [ ] EC-30: una original con `<script>` en la descripción → la copia guarda el texto idéntico.
- [ ] EC-49: publicar, cerrar y duplicar con `Sec-Fetch-Site: cross-site` → 403 `CROSS_SITE_REQUEST` y nada cambia
      (ningún borrador nuevo al duplicar); con `same-origin`, `same-site`, `none` o sin cabecera → su 2xx.
- [ ] `npm test -w apps/api -- publish close duplicate cross-site` en verde, con **4** ficheros de test ejecutados (o
      más, si se crearon hermanos `-adversarial`).
- [ ] `npm test -w apps/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/jobs/publish.test.ts apps/api/test/jobs/close.test.ts apps/api/test/jobs/duplicate.test.ts apps/api/test/http/cross-site.test.ts`
      sin errores (más los hermanos y los ficheros de `src/` si hubo que arreglar algo).
- [ ] Commit único `test(jobs): adversarial tests for publish, close and duplicate [HU-02 TASK-04]` nombrando los
      ficheros.

## Notas de implementación
- **Orden de comprobación** (DT-04 + DEC-12): `Sec-Fetch-Site` (403) → JSON Schema / `rejectBody` (400) → existencia
  (404) → estado (409) → reglas del servicio (400). `rejectBody` corre antes que el esquema de `params`: con ID inválido
  **y** cuerpo, `details` solo trae `body`.
- En `inject`, una acción «sin cuerpo» es `inject({ method: 'POST', url })` **sin** `payload`; con `payload: {…}`
  Fastify pone `Content-Type: application/json` y llega un cuerpo.
- `failWrites(db, op)` crea un *trigger* real: créalo **después** de preparar los datos del test.
- Los mensajes de SQLite y del puerto solo van al log; el cliente recibe el `message` fijo de `INTERNAL_ERROR`. Compara
  el envelope **completo** (RNF-03).
- Nombres de los tests (TD): `publish.test.ts` › «EC-01 ID no válido o con cuerpo → 400 sin cambios», «CA-03/EC-02
  campos pendientes → 400, uno por campo, y sigue en draft», «CA-04 publicar una cerrada → 409 y nada cambia», «EC-05
  fallo de SQLite al publicar → 500 y sigue en draft», «EC-06 publicar una oferta borrada → 404», «EC-08 IDs
  inexistentes → 404 sin ID ni datos»; `close.test.ts` › «EC-10 ID no válido (1.5) o con cuerpo → 400 sin cambios»,
  «CA-08 cerrar un borrador → 409 y sigue en draft», «CA-09/EC-12 el punto de rechazo falla → 500 y sigue publicada»,
  «EC-12 fallo de SQLite al cerrar → 500 y sigue publicada», «DT-01 close-preview de una oferta inexistente → 404; ID
  inválido → 400»; `duplicate.test.ts` › «EC-25 ID no válido → 400; inexistente → 404; no se crea nada», «EC-27 fallo de
  SQLite al duplicar → 500 sin borrador nuevo», «EC-30 la copia guarda el HTML tal cual».

## Reapertura · review ronda 1 (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, `VERDICT: Requiere cambios`), §9.
- **Qué hay que hacer:** EC-14 (RF-02 Must, categoría 5) no tiene test. Fija con un test de la API el comportamiento de la ventana de INV-05 que declara el PRD: con el puerto por defecto (`noJobApplications`, sin `jobApplications` en `createTestApp`), cerrar una oferta publicada da 200 `closed`, `GET /api/jobs/:id/close-preview` da `{ activeApplications: 0 }` antes de cerrar, y no hay inscripciones que rechazar. Nombre del test con «EC-14» y un comentario que diga que HU-05 lo sustituirá al conectar UC-19. Si `close.test.ts` (197) pasa de 300, crea un hermano.
- **Ficheros:** `apps/api/test/jobs/close.test.ts`
- **Criterios de done:** `npm test -w @ats/api -- close` en verde; `npm run typecheck -w @ats/api`; `npx eslint` del fichero.
