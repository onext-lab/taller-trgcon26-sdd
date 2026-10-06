# TASK-04 — Edición y consentimiento en la API (`PATCH /:id`, `POST /:id/consent`, `POST /:id/consent/withdrawal`)

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-03, RF-06, RF-07 recálculo)
- **Complejidad:** L (2–4 h; estimada 4 h)

## Descripción
Las tres escrituras sobre una ficha existente, en el módulo de TASK-03:
1. **Edición** `PATCH /api/candidates/:id` con `updateCandidateBodySchema` (como el alta sin `required` ni `consent`,
   `minProperties: 1`, `fullName`/`email` sin `null`, y `consent` también en `forbiddenFields`). El servicio hace
   lectura-fusión-escritura de 5 columnas con `updateFields` (lista fija) y **nunca** toca la retención ni el
   consentimiento (RN-10). Gana la última escritura (DEC-08). Email de otro → 409 `DUPLICATE` con `existingId`.
2. **Registrar o renovar** `POST /api/candidates/:id/consent` sin cuerpo (`rejectBody`): `consentGivenAt = now`,
   `consentVersion = 'v1'`, `consentWithdrawnAt = null` y `recalculateRetention`, en una transacción.
3. **Retirar** `POST /api/candidates/:id/consent/withdrawal` sin cuerpo: con uno vigente, `consentWithdrawnAt = now` y
   recálculo; **sin uno vigente**, devuelve la ficha sin llamar a `now()`, sin escribir y sin recalcular (DD-09).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/modules/candidates/schemas.ts` | modificar | `updateCandidateBodySchema` |
| `apps/api/src/modules/candidates/repository.ts` | modificar | `updateFields(id, fields)`, `setConsent(id, { givenAt, version, withdrawnAt })` |
| `apps/api/src/modules/candidates/service.ts` | modificar | `update`, `giveConsent`, `withdrawConsent` |
| `apps/api/src/modules/candidates/routes.ts` | modificar | `PATCH /:id`, `POST /:id/consent`, `POST /:id/consent/withdrawal` |
| `apps/api/test/candidates/update.test.ts` | crear | CA-07 a CA-13, EC-19, EC-20, EC-21, EC-24, EC-26, EC-38 |
| `apps/api/test/candidates/consent.test.ts` | crear | CA-25 a CA-28, CA-31 (puerto por defecto), EC-43, EC-44, EC-49, EC-57 |

## Implementa
- RF: RF-03, RF-06, RF-07 (recálculo al cambiar el consentimiento) · CA: CA-07 a CA-13, CA-25 a CA-28, CA-31 (puerto
  por defecto) · Edge cases: EC-19, EC-20, EC-21, EC-24, EC-26, EC-38, EC-43, EC-44, EC-49, EC-57
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Endpoints (`PATCH`, `consent`, `withdrawal`), § Firmas internas
  (`update`, `giveConsent`, `withdrawConsent`), § Diagrama de secuencia, DD-05, DD-09, § Checklist B-04

## Dependencias
- **Depende de:** TASK-03
- **Bloquea:** TASK-05, TASK-07, TASK-08, TASK-11, TASK-12

## Criterios de done
- [ ] CA-07: teléfono « +34 600 000 001 », resumen nuevo y skills `['SQL','Python']` → 200 con `+34 600 000 001` y
      `['sql','python']`; `retentionEndsAt` sigue `2027-04-06` y el consentimiento no cambia.
- [ ] CA-08: ` Nuevo.Correo@Example.com ` libre → `nuevo.correo@example.com`. CA-09: ` Jose.Ruiz@Example.com` sobre su
      propio `jose.ruiz@example.com` → 200 sin 409.
- [ ] CA-10 / EC-26: el mismo `PATCH` dos veces, o sin cambios reales → 200 y ficha idéntica; retención y
      consentimiento iguales.
- [ ] CA-11: resumen de 2 001, nombre vacío o `retentionEndsAt` → 400 en su campo y la ficha no cambia; 2 000 → 200.
- [ ] CA-12: email de otro candidato → 409 `DUPLICATE` con `existingId` del otro y sin el email en el cuerpo.
- [ ] CA-13: ID inexistente → 404 sin datos. EC-20: `PATCH /api/candidates/abc` → 400 en `id`.
- [ ] EC-19: `{}` → 400 «Envía al menos un campo.»; `consent`, `createdAt`, `id` o `retentionEndsAt` → 400 con su
      nombre; la ficha no cambia.
- [ ] EC-21: `phone: ""`, `summary: "   "`, `skills: []` → 200 con `null`, `null` y `[]`; retención igual.
- [ ] EC-24: `retention_ends_at` puesta a `NULL` por SQL sigue `null` tras un `PATCH`.
- [ ] EC-38: `GET /:id` tras un `PATCH` devuelve lo último.
- [ ] CA-25 (reloj 2026-10-06T09:00:00Z): registrar → fecha del reloj, `v1` y `2028-10-06`.
- [ ] CA-26: alta 2026-02-06, consentimiento 2026-03-01, retirar el 2026-10-06 → se conservan otorgamiento y versión,
      retirada 2026-10-06 y retención `2026-08-06` aunque haya pasado (EC-43).
- [ ] CA-27: renovar un vigente del 2026-03-01 el 2026-10-06 → fecha nueva, `v1` y `2028-10-06`.
- [ ] CA-28: retirar sin vigente (nunca dado y ya retirado) → 200 con la ficha idéntica byte a byte, sin fechas nuevas.
- [ ] EC-44: reotorgar tras retirar → fecha y versión nuevas y `consentWithdrawnAt: null`.
- [ ] EC-49: retirar dos veces → 200 igual; registrar dos veces → la segunda renueva con fecha nueva.
- [ ] CA-31 / EC-57: con la app por defecto (`noCandidateProcesses`) toda ficha tiene fecha de fin; dos recálculos
      seguidos dan la misma fecha.
- [ ] `npm test -w @ats/api -- candidates/update.test candidates/consent.test` en verde, con **2** ficheros de test.
- [ ] `npm test -w @ats/api -- candidates` en verde (lo de TASK-02 y TASK-03 sigue igual).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/schemas.ts apps/api/src/modules/candidates/repository.ts apps/api/src/modules/candidates/service.ts apps/api/src/modules/candidates/routes.ts apps/api/test/candidates/update.test.ts apps/api/test/candidates/consent.test.ts`
      sin errores.
- [ ] Commit único `feat(api): edit candidates and manage consent [HU-03 TASK-04]` nombrando los ficheros.

## Notas de implementación
- **Edición** (`update`): dentro de `transaction`: `findById` (404 si no existe) → fusiona los campos enviados →
  `updateFields(id, fields)` con la lista fija `full_name, email, phone, summary, skills` (sin la columna de
  retención) → `findById`. El `UNIQUE` del email se traduce igual que en el alta (`isDuplicateEmailError` +
  `findIdByEmail` → `duplicate`). Mismo email con otra forma: tras normalizar es igual y no choca consigo mismo.
- **Consentimiento**: las dos rutas usan `rejectBody` (`preValidation`) antes de `idParamsSchema`; cualquier cuerpo,
  también `{}`, → 400 `body` «Esta acción no admite cuerpo.» (sus tests van en TASK-08).
- `giveConsent(id)`: `transaction(() => { findById → 404; setConsent(id, { givenAt: now(), version: 'v1',
  withdrawnAt: null }); return recalculateRetention(id); })`.
- `withdrawConsent(id)`: vigente = `consentGivenAt !== null && consentWithdrawnAt === null`. Sin vigente, devuelve la
  ficha leída (DD-09). Con vigente, `setConsent` con `withdrawnAt: now()` conservando `givenAt` y `version`, y
  `recalculateRetention`.
- `recalculateRetention` se une a la transacción en curso (`withTransaction`, DEC-11.7): consentimiento y retención
  cambian juntos o no cambian (CA-30 y EC-45 se prueban en TASK-08).
- Un solo estado de consentimiento, sin historial (DT-03).
- Ficheros por debajo de 300 líneas; si `service.ts` se acerca, saca las tres operaciones de consentimiento a una
  función interna del mismo fichero antes que crear otro.
