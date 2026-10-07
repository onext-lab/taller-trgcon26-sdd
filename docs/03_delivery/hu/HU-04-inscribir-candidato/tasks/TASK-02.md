# TASK-02 — SEC-02: guarda de estado en el SQL de edición y borrado de ofertas, con regresión previa

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Should (RF-12; cierra SEC-02 de la review de HU-02)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Defensa en profundidad en `jobs`: el `UPDATE` de edición y el `DELETE` llevan la guarda de estado en el propio `WHERE`,
como ya hacen `MARK_PUBLISHED_SQL` y `MARK_CLOSED_SQL`. Pasos, **en este orden (obligatorio, decisión del aprobador)**:

1. **Regresión antes de tocar el SQL.** Crea `apps/api/test/jobs/state-guards.test.ts` con un `describe` de regresión
   de las respuestas de ofertas y ejecútalo **en verde con el código actual** (la salida se pega en el brief):
   - `PATCH /api/jobs/:id` de una `draft` y de una `published` → 200 con el `Job` completo (cuerpo entero con
     `toEqual`);
   - `PATCH` de una `closed` → 409 `INVALID_TRANSITION` «Una oferta cerrada no se puede editar.»;
   - `DELETE /api/jobs/:id` de una `draft` → 204;
   - `DELETE` de una `published` → 409 «Una oferta publicada no se puede borrar.»; de una `closed` → 409 «Una oferta
     cerrada no se puede borrar.»;
   - `PATCH` y `DELETE` de una inexistente → 404 «La oferta no existe.».
2. **SQL** de `apps/api/src/modules/jobs/repository.ts`:
   - `UPDATE_SQL`: `WHERE id = ? AND status IN ('draft','published')`;
   - `deleteById`: `DELETE FROM job_openings WHERE id = ? AND status = 'draft'`.
   Actualiza los comentarios JSDoc de `update` y `deleteById` (hoy dicen «si no hay fila con ese `id`»).
3. **Servicio** (`apps/api/src/modules/jobs/service.ts`, DD-09): en `update`, si el repositorio devuelve `undefined`, y
   en `remove`, si `deleteById` devuelve 0, lanza `invalidTransition('El estado de la oferta ha cambiado: recarga e
   inténtalo de nuevo.')` (hoy lanzan `notFound`). Bajo `BEGIN IMMEDIATE`, tras `requireJob` y `checkAction`, 0 filas
   solo puede ser un estado no permitido.
4. **CA-22**, en el mismo fichero:
   - repositorio directo (`createJobsRepository(db)`): `update` sobre una `closed` → `undefined`, y `deleteById` sobre una
     `published` → 0; en los dos casos la fila releída es idéntica a la de antes;
   - servicio: un repositorio real envuelto cuyo `findById` devuelve la oferta como `published` cuando en la base está
     `closed` → `update` lanza 409 `INVALID_TRANSITION` con el mensaje de DD-09; y uno que la devuelve como `draft`
     cuando está `published` → `remove` lanza el mismo 409. El servicio se construye con las mismas dependencias que le
     pasa `buildApp`.
5. **La regresión del paso 1, otra vez en verde, sin haber tocado** su `describe`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/state-guards.test.ts` | crear | Regresión (paso 1) y CA-22 (paso 4) |
| `apps/api/src/modules/jobs/repository.ts` | modificar | Guarda en `UPDATE_SQL` y en el `DELETE` de `deleteById` |
| `apps/api/src/modules/jobs/service.ts` | modificar | 0 filas en `update` y `remove` → 409 `INVALID_TRANSITION` (DD-09) |

## Implementa
- RF: RF-12 · CA: CA-22
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (pieza 5), DD-09, § Estrategia de tests › SEC-02 (B-02),
  § Checklist B-02

## Dependencias
- **Depende de:** nada (puede ir en paralelo con TASK-01: no comparten ficheros)
- **Bloquea:** TASK-03 (que también modifica `apps/api/src/modules/jobs/repository.ts`)

## Criterios de done
- [ ] **Antes de tocar producción:** `npm test -w @ats/api -- jobs/state-guards` en verde (1 fichero) con el código
      actual, con la salida pegada en el brief.
- [ ] **Después:** `npm test -w @ats/api -- jobs/state-guards` en verde, con la regresión sin tocar.
- [ ] `npm test -w @ats/api -- jobs` en verde (20 ficheros): `update.test.ts`, `delete.test.ts`,
      `status-rules.test.ts`, `status-rules-adversarial.test.ts` y el resto de `apps/api/test/jobs/` **no se tocan**.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/service.ts apps/api/test/jobs/state-guards.test.ts`
      sin errores.
- [ ] `state-guards.test.ts` ≤ 300 líneas tras Prettier.
- [ ] Commit único `fix(api): guard job edit and delete by status in SQL (SEC-02) [HU-04 TASK-02]`.

## Notas de implementación
- `MARK_PUBLISHED_SQL` y `MARK_CLOSED_SQL` son el patrón a seguir (comentario DD-08 del repositorio).
- El 409 de DD-09 es inalcanzable por la API (el servicio comprueba antes): su mensaje difiere de los de `rules.ts` a
  propósito. No añadas una relectura ni un segundo `checkAction` (opción A descartada en DD-09).
- `DELETE /api/jobs/:id` no cambia de comportamiento: un borrador nunca tiene inscripciones (INV-02) y la FK
  `RESTRICT` de TASK-01 no le afecta.
- Helpers existentes: `createTestApp`, `createJob`, `publishJob`, `closeJob`, `createPublishedJob`
  (`apps/api/test/helpers/test-app.ts`).
