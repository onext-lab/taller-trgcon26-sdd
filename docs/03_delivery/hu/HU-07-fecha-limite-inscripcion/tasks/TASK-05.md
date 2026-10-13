# TASK-05 — Fecha límite e inscripción frente a entradas hostiles, fallos y concurrencia [adversarial]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** test
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
La tarea `[adversarial]` de los dos RF Must de la API (gate 4): ataca la fecha límite de la oferta (RF-01) y la
inscripción fuera de plazo (RF-02) por las categorías de `docs/07_architecture_principles/QUALITY-GATES.md` § 3 que no
cubre el camino feliz de TASK-01 a TASK-04. Son tests contra el código ya escrito; si alguno falla, el arreglo va en
esta tarea, en el fichero de producción de su RF (`apps/api/src/modules/jobs/{rules,service}.ts` o
`apps/api/src/modules/applications/service.ts`), sin cambiar el contrato.

Reloj `createTestClock('2026-10-13T10:00:00Z')` salvo que se diga otra cosa; ofertas vencidas creadas moviendo el reloj
(DD-12); fallos reales con `failWrites` (`apps/api/test/helpers/test-app.ts`), sin mocks; datos inventados.

1. `apps/api/test/jobs/deadline-adversarial.test.ts` (**crear**) — RF-01:

   | Test | Categoría | Esperado |
   |---|---|---|
   | «EC-01/EC-07 %s → 400 sin repetir el valor y sin escribir» (`it.each`: `2026-02-31`, `13/10/2026`, `2026-10-13T00:00:00Z`, `<script>alert(1)</script>`, `' OR 1=1 --`, en alta y en edición) | 1 Input inválido · 6 Seguridad | 400 `VALIDATION_ERROR`, `details: [{ field: 'enrollmentDeadline', message: 'Introduce una fecha válida.' }]`; el cuerpo de la respuesta **no contiene** el valor enviado (DEC-11.4); 0 ofertas nuevas o la oferta igual |
   | «EC-01 un número → 400 «Debe ser un texto.»» | 1 | Mensaje de Ajv |
   | «EC-01 más de 32 caracteres → 400 «Debe tener como máximo 32 caracteres.»» | 1 · 6 (abuso de tamaño) | DD-03 |
   | «EC-04 falla el UPDATE de enrollment_deadline → 500 y la oferta igual» (`failWrites(db, 'UPDATE', { column: 'enrollment_deadline' })`) | 3 Fallo de dependencia | 500 `INTERNAL_ERROR` genérico; `GET` igual que antes |
   | «EC-09 closed: cambiar o quitar la fecha → 409 INVALID_TRANSITION» (`{ enrollmentDeadline: '2026-11-30' }` y `{ enrollmentDeadline: null }`) | 2 Boundary | 409 «Una oferta cerrada no se puede editar.»; la oferta igual |
   | «Frontera de día al crear: UTC 13 y Madrid 14» (reloj `2026-10-13T22:30:00Z`, fecha `2026-10-13`) | 2 Boundary | 400 «La fecha límite no puede ser anterior a hoy.»; con `2026-10-14` → 201 |

2. `apps/api/test/applications/enroll-deadline-adversarial.test.ts` (**crear**) — RF-02:

   | Test | Categoría | Esperado |
   |---|---|---|
   | «EC-12 falla el INSERT dentro de plazo → 500 y nada escrito» (`failWrites` sobre `applications`, plazo hoy) | 3 Fallo de dependencia | 500; 0 inscripciones, 0 `StageChange`, retención del candidato igual |
   | «EC-13 el plazo se lee dentro de BEGIN IMMEDIATE; recortado a hoy, se inscribe» (`createJobStatusSpy` sobre el lector real → `deadlineInsideTransaction` = `[true]`; recortar el plazo a hoy por `PATCH` y luego inscribir a las 23:59:59 de Madrid → 201) | 4 Concurrencia | DEC-08 |
   | «EC-15 el 409 solo lleva code y message con la fecha; nada en el log» (log capturado como en `apps/api/test/applications/privacy-logs.test.ts`) | 6 Seguridad | Cuerpo exactamente `{ error: { code: 'ENROLLMENT_DEADLINE_PASSED', message: 'El plazo de inscripción de esta oferta terminó el 13/10/2026.' } }`; sin `details`; sin nombre, email ni teléfono del candidato; 0 líneas de log con datos del candidato |
   | «getEnrollmentDeadline lanza → 500 sin datos y nada escrito» (`createJobStatusStub({ failDeadline: true })`, de TASK-03) | 3 | 500 genérico; 0 inscripciones |

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/api/test/jobs/deadline-adversarial.test.ts` | Crear | EC-01, EC-04, EC-07, EC-09, `maxLength`, frontera de día al crear |
| `apps/api/test/applications/enroll-deadline-adversarial.test.ts` | Crear | EC-12, EC-13, EC-15, fallo del puerto |

## Implementa
- RF: RF-01, RF-02 (cobertura adversarial) · Edge cases: EC-01, EC-04, EC-07, EC-09, EC-12, EC-13, EC-15
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths, § Threat modeling, § Estrategia de tests (filas
  `[adversarial]`), § Checklist de implementación (puntos 4 y 5, parte adversarial)

## Dependencias
- **Depende de:** TASK-02, TASK-03
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- deadline-adversarial` en verde, con **2** ficheros de test.
- [ ] Cada test nombra su EC y su categoría de QUALITY-GATES § 3 en el `describe` o el título.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/jobs/deadline-adversarial.test.ts apps/api/test/applications/enroll-deadline-adversarial.test.ts`
      sin errores (más el fichero de producción si hubo arreglo).
- [ ] Ningún fichero pasa de 300 líneas.
- [ ] Commit único `test(api): adversarial tests for enrollment deadline and late enrollment [HU-07 TASK-05]` (o
      `fix(api): …` si hubo arreglo de producción, nombrándolo en el cuerpo).

## Notas de implementación
- Para comprobar «no repite el valor», busca el texto enviado en `response.body` (no solo en `details`).
- EC-04: el trigger de `failWrites` con `column` es `UPDATE OF enrollment_deadline`; como `UPDATE_SQL` escribe todas
  las columnas editables, salta en cualquier `PATCH`. Es lo que se quiere: la escritura falla y la transacción se
  deshace.
- EC-13: el espía de TASK-03 registra `deadlineInsideTransaction`; no añadas otro.
- Si un test descubre un fallo real, cuenta como ciclo de arreglo de esta tarea (techo de 2, `docs/IMPLEMENTATION-RULE.md`).
