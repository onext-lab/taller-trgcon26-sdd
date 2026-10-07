# TASK-07 — Inscribir frente a entradas hostiles y concurrencia [adversarial]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (adversarial de RF-01 y RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Primera mitad de B-07 del TD (partido por el gate 4: una `[adversarial]` es S o M). Ataca `POST /api/applications`
con cuerpos mal formados, límites, peticiones entre sitios y carreras. Cada caso comprueba la respuesta **y** que no se
creó nada (`SELECT COUNT(*)` de `applications` y de `stage_changes`) y, donde aplica, que la retención del candidato no
cambió. Si un test destapa un fallo, se arregla en el fichero de producción de `applications/` que corresponda (sin
adaptar el test al fallo).

Fichero `apps/api/test/applications/enroll-adversarial.test.ts`:
- **Input inválido** (`it.each`): «CA-10/EC-01/EC-02 sin candidateId, "7", 0, -3, 1.5, stage, no JSON, form → 400/415»:
  sin `candidateId`; `candidateId: "12"` (texto); `0`; `-3`; `1.5`; `stage: 'hired'` (sale **una** vez como
  `{ field: 'body', message: 'Hay campos no permitidos.' }`, sin nombrarla, junto con `id` o `createdAt` si van);
  cuerpo que no es JSON y cuerpo vacío → 400; `text/plain` → 400; `application/x-www-form-urlencoded` → 415.
- **CA-03** «candidateId como lista → 400 y 0 filas».
- **Boundary** «EC-03 MAX_SAFE_INTEGER inexistente → 404 sin datos; MAX_SAFE_INTEGER + 1 → 400», en `jobId` y en
  `candidateId` (el `+ 1` se envía como JSON crudo, `payload: '{"jobId":9007199254740992,…}'`).
- **Seguridad** «EC-10 Sec-Fetch-Site cross-site y same-site → 403 CROSS_SITE_REQUEST y 0 filas».
- **Concurrencia**:
  - «CA-07/EC-06 dos POST a la vez → 201 y 409 con el ID; 1 inscripción y 1 StageChange» (`Promise.all` de dos
    `inject` con la misma pareja; el 409 lleva `existingId` = ID del 201);
  - «EC-07 la oferta se cierra antes del POST → 409 INVALID_TRANSITION y 0 filas» (`closeJob` y luego `enroll`);
  - «EC-19 el puerto de estado se lee con db.isTransaction === true» (espía de `apps/api/test/helpers/applications.ts`
    pasado como `jobStatus` a `createTestApp`); y cerrar y luego inscribir → 409.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/enroll-adversarial.test.ts` | crear | CA-03, CA-07, CA-10, EC-01, EC-02, EC-03, EC-06, EC-07, EC-10, EC-19 |
| `apps/api/src/modules/applications/schemas.ts` · `apps/api/src/modules/applications/service.ts` · `apps/api/src/modules/applications/routes.ts` | modificar solo si un test destapa un fallo | Arreglos, sin cambiar el contrato |

## Implementa
- RF: RF-01, RF-03 · CA: CA-03 (API), CA-07, CA-10 · Edge cases: EC-01, EC-02, EC-03, EC-06, EC-07, EC-10, EC-19
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-01 a EC-03, EC-06, EC-07, EC-10, EC-19), § Threat modeling
  (CSRF, *mass assignment*, inyección), DD-02, DD-03, § Checklist B-07

## Dependencias
- **Depende de:** TASK-04
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/enroll-adversarial` en verde, con **1** fichero de test.
- [ ] Si hubo arreglos: `npm test -w @ats/api -- applications` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/enroll-adversarial.test.ts` (más los ficheros de producción arreglados, si
      los hay) sin errores.
- [ ] `enroll-adversarial.test.ts` ≤ 300 líneas tras Prettier.
- [ ] Commit único `test(api): enroll against hostile input and races [HU-04 TASK-07]`.

## Notas de implementación
- Con `node:sqlite` síncrono, los dos `inject` del `Promise.all` se serializan dentro de Fastify; lo que se prueba es
  que el segundo lo decide el índice único (DD-03), no un `SELECT` previo.
- `EC-19`: con `BEGIN IMMEDIATE`, SQLite serializa a los escritores; el espía fija que la lectura del puerto va dentro
  de la transacción (DD-02). Su tradeoff (toda escritura del estado de una oferta en transacción) queda documentado
  así.
- La clave desconocida no se nombra (DEC-11.4): no declares `stage`, `id` ni fechas con `forbiddenFields`.
- Los 404 no devuelven ningún dato; la diferencia entre 404 de oferta y de candidato es aceptada con DEC-04.
- Datos inventados (`@example.com`).
