# TASK-04 — Cierre frente a fallos de escritura, entradas hostiles y concurrencia [adversarial]

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** test (backend)
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01, RF-02, RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Casos hostiles del cierre con el puerto real. **Sin código de producción**: si un test destapa un fallo, se arregla en
`apps/api/src/modules/applications/job-closing.ts` dentro de esta tarea (techo de 2 ciclos) y se avisa.

1. **`failWrites` con `whenNew`** (`apps/api/test/helpers/test-app.ts`, DD-09). Nueva opción en `FailWritesTarget`:
   ```ts
   /** Falla solo la fila cuyo `NEW.<column>` es `equals` (p. ej., la 2.ª de 3). */
   whenNew?: { column: 'id' | 'application_id'; equals: number };
   ```
   Añade `WHEN NEW.<column> = <equals>` al trigger. `column` es una unión literal; `equals` se valida con
   `Number.isSafeInteger` y, si no lo es, `throw new Error(…)` **antes** de componer el DDL (excepción anotada de
   RNF-05: SQLite no admite parámetros en `CREATE TRIGGER`; solo literales del test y un entero validado). El nombre
   del trigger incluye el sufijo de `whenNew` para no chocar. Sin `whenNew`, el comportamiento actual no cambia (lo
   usan otros tests). Actualiza el comentario de `failWrites`.
2. **`apps/api/test/applications/close-reject-adversarial.test.ts`** (nuevo) con los tests de abajo.

**EC-03 / CA-06: el fallo en la 2.ª de 3 filas (lo exige la prueba de mutación M3).** Oferta publicada con **3**
inscripciones activas de 3 candidatos distintos (orden de `id`: primera, segunda, tercera). `it.each` sobre los tres
puntos de escritura, siempre sobre la **segunda**:

| Punto | Llamada |
|---|---|
| `UPDATE de applications` | `failWrites(db, 'UPDATE', { table: 'applications', whenNew: { column: 'id', equals: second.id } })` |
| `INSERT de stage_changes` | `failWrites(db, 'INSERT', { table: 'stage_changes', whenNew: { column: 'application_id', equals: second.id } })` |
| `UPDATE de retention_ends_at` | `failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at', whenNew: { column: 'id', equals: second.candidateId } })` |

Se toma una **foto antes** (etapa y `last_change_at` de las 3, número de `stage_changes`, `retention_ends_at` de los 3
candidatos) y, tras `POST /api/jobs/:id/close`, se exige: 500 con el envelope `INTERNAL_ERROR` exacto (sin *stack*); la
oferta sigue `published` con `closedAt` `null` (por `GET /api/jobs/:id`); **las tres** inscripciones, incluida la
**primera** (ya procesada cuando falla la segunda), iguales a la foto; mismo número de `stage_changes` y 0 con
`job_closed`; retenciones iguales a la foto.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/helpers/test-app.ts` | modificar | `FailWritesTarget.whenNew` y su `WHEN NEW.<column> = <entero>` validado |
| `apps/api/test/applications/close-reject-adversarial.test.ts` | crear | CA-06/EC-03, EC-08, EC-10, EC-14, EC-16, EC-17, EC-18, EC-19 |

## Implementa
- RF: RF-01 (fallo de dependencia), RF-02 (input inválido, fallo de dependencia), RF-03 (input inválido, fallo de
  dependencia, concurrencia, datos legacy, seguridad) · Edge cases: EC-03, EC-08, EC-10, EC-14, EC-16, EC-17, EC-18,
  EC-19 · CA-06 · DD-09
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths, DD-09, § Threat modeling (excepción de RNF-05), § Estrategia
  de tests (`close-reject-adversarial.test.ts`), § Checklist 4

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- applications/close-reject-adversarial` en verde con **1** fichero y estos tests:
  - `CA-06/EC-03 falla %s en la 2.ª de 3 → 500 y nada cambia` (`it.each` sobre los 3 puntos de la tabla).
  - `EC-08/EC-14 id 1.5 o con cuerpo → 400 y nada rechazado`: `GET /api/jobs/1.5/close-preview` → 400
    `VALIDATION_ERROR`; `POST /api/jobs/1.5/close` → 400; `POST /api/jobs/:id/close` con cuerpo sobre una oferta con
    activas → 400; la oferta sigue `published`, sus inscripciones en su etapa y 0 `StageChange` nuevos (`abc` y
    `999999` ya los cubre `jobs/close.test.ts:186`).
  - `EC-10 el recuento lanza → 500 INTERNAL_ERROR sin datos` (`createTestApp({ jobApplications })` con un doble cuyo
    `countActiveApplications` lanza un `Error` de texto fijo; cuerpo = envelope exacto).
  - `EC-16 falla el UPDATE de job_openings → 500 y ninguna inscripción cambia` (`failWrites(db, 'UPDATE')`).
  - `EC-17 dos cierres a la vez → un closedAt y StageChange solo del primero` (`Promise.all` de dos `POST`: ambos 200
    con el mismo `closedAt`; exactamente un `StageChange` `job_closed` por inscripción activa).
  - `EC-18 closed con activas escritas por SQL → POST /close no-op` (oferta cerrada vacía + `insertApplicationAt`
    activa: 200 con el `closedAt` original, la inscripción sigue en su etapa, 0 `StageChange`).
  - `EC-19 Sec-Fetch-Site cross-site → 403 y nada rechazado` (403 `CROSS_SITE_REQUEST`; oferta `published` e
    inscripciones intactas).
- [ ] **Mutación M3 de la review** (sacar el rechazo fuera de la transacción del cierre, p. ej. llamarlo en
      `jobs/service.ts` después de que el `transaction(…)` del cierre haga `COMMIT`): la detecta `close-reject-adversarial.test.ts ›
      CA-06/EC-03 falla %s en la 2.ª de 3 → 500 y nada cambia` en los **3** puntos (la oferta queda `closed` o la
      primera inscripción queda `rejected`). Comprobación manual del builder, sin commitear: aplicar M3, ver los 3
      casos en rojo y deshacerla; el diff final no toca `apps/api/src/modules/jobs/service.ts`.
- [ ] `failWrites` con `whenNew.equals` no entero (`1.5`, `NaN`) lanza antes de ejecutar DDL (aserción en el propio
      fichero o en el `it.each`).
- [ ] `npm test -w apps/api -- applications/ jobs/ module-boundaries` en verde (el helper es compartido: los usos sin
      `whenNew` no cambian).
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función nueva o modificada de 50 (`wc -l` tras Prettier).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/helpers/test-app.ts apps/api/test/applications/close-reject-adversarial.test.ts`
      sin errores.
- [ ] Commit único `test(api): adversarial job close with write failures, hostile input and concurrency [HU-06 TASK-04]`
      con los 2 ficheros.

## Notas de implementación
- **Instala los triggers después de preparar los datos.** Inscribir y avanzar también escriben `stage_changes` (el
  inicial y cada paso) y recalculan la retención: un trigger puesto antes haría fallar la preparación, no el cierre.
- Prepara las 3 inscripciones con `insertApplicationAt` o por la API; el reloj del cierre, posterior a todos los
  `created_at` (`CHECK last_change_at >= created_at`).
- La «foto antes» compara valores (etapa, `last_change_at`, retención), no solo recuentos: con M3, la primera
  inscripción queda `rejected` o la oferta `closed`, y eso es lo que tiene que hacer fallar el test. Por eso el fallo va
  en la **segunda** fila: en la primera no habría nada escrito antes que delatara la mutación.
- Si `close-reject-adversarial.test.ts` se acerca a 300 líneas, para y avisa: no se reparte sin acuerdo.
- Sin mocks de módulo: fallos reales de SQLite y dobles del puerto por inyección (`createTestApp`).
