# TASK-07 — Avanzar y rechazar frente a fallos de escritura y a la etapa desfasada [adversarial]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Segunda mitad de B-06 del diseño (partido para que cada `[adversarial]` sea S o M, gate 4): fallo de dependencia en
cada escritura de la transacción y el camino defensivo de la guarda del `UPDATE`. Un único fichero nuevo,
`apps/api/test/applications/stage-change-failures-adversarial.test.ts`, con el patrón de
`apps/api/test/applications/enroll-failures-adversarial.test.ts`.

1. **Fallos inyectados (EC-05, EC-14; CA-11, CA-20)** con `failWrites` (`apps/api/test/helpers/test-app.ts`), creado
   **después** de preparar candidato, oferta e inscripción:
   - `failWrites(db, 'UPDATE', { table: 'applications' })`;
   - `failWrites(db, 'INSERT', { table: 'stage_changes' })`;
   - `failWrites(db, 'UPDATE', { table: 'candidates', column: 'retention_ends_at' })` (al contratar y al rechazar).

   En cada caso: 500 `INTERNAL_ERROR` sin *stack* ni datos; etapa, `last_change_at`, historial y `retention_ends_at`
   exactamente como antes (`ROLLBACK` de todo). Para el avance, el de la retención se prueba con `offer → hired` (un
   avance intermedio no recalcula, DD-07).
2. **Guarda del `UPDATE` (DD-02):** con `BEGIN IMMEDIATE` y una conexión síncrona es inalcanzable por la API. Se prueba
   componiendo el servicio directamente con `createApplicationsService` (`apps/api/src/modules/applications/service.ts`)
   sobre un **repositorio real envuelto** (`createApplicationsRepository(db)` con `findById` que devuelve la etapa
   anterior a la guardada) y `withTransaction`: `advance` y `reject` lanzan `STAGE_MISMATCH` (409) y no se escribe ningún
   `StageChange`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/stage-change-failures-adversarial.test.ts` | crear | CA-11, CA-20, EC-05, EC-14, DD-02 |
| `apps/api/src/modules/applications/service.ts` | modificar solo si un caso destapa un bug | Arreglo mínimo, citado en el commit |

## Implementa
- RF: RF-01, RF-02 · CA: CA-11, CA-20 · EC: EC-05, EC-14 · DD-02, DD-07
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-05, EC-14), DD-02, § Estrategia de tests (CA-11, CA-20,
  DD-02), § Checklist B-06

## Dependencias
- **Depende de:** TASK-03, TASK-04
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/stage-change-failures` en verde con **1** fichero, con estos nombres:
      «CA-11 fallo en UPDATE, en INSERT del StageChange y en retention al contratar → 500 y nada cambia» (`it.each` de
      los 3); «CA-20 fallo en UPDATE, INSERT y retención al rechazar → 500 y nada cambia» (`it.each` de los 3); «DD-02
      findById desfasado → 409 STAGE_MISMATCH sin StageChange» (avance y rechazo).
- [ ] Ningún cuerpo de 500 lleva *stack*, nombre, email, teléfono ni nota.
- [ ] `npm test -w @ats/api -- applications/` en verde (sin regresiones).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/stage-change-failures-adversarial.test.ts` (y producción si se toca) sin
      errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `test(api): injected write failures and stale-stage guard on stage changes [HU-05 TASK-07]`.

## Notas de implementación
- Los triggers `fail_*` de `failWrites` son *fixtures*: créalos después de preparar los datos o fallarán los `INSERT`
  del propio fixture.
- `recalculateRetention` se une a la transacción en curso: su fallo debe revertir también el `UPDATE` y el `INSERT`.
- La ausencia de fuga de datos en **logs** la prueba TASK-08 (`stage-change-privacy.test.ts`).
