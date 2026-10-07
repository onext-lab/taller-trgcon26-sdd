# TASK-08 — Inscribir frente a fallos de dependencias, y datos personales en logs y errores [adversarial]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (adversarial de RF-01, RF-03, RF-04 y RF-10; RNF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Segunda mitad de B-07 del TD (partido por el gate 4). Inyecta un fallo en cada efecto de la transacción de inscribir y
comprueba que no queda nada a medias (DEC-06: un test de fallo por efecto cruzado), y que ni las respuestas ni los logs
llevan datos personales. Si un test destapa un fallo, se arregla en producción (sin adaptar el test).

1. `apps/api/test/applications/enroll-failures-adversarial.test.ts`:
   - «CA-11/EC-05/EC-52 fallo en INSERT de applications, de stage_changes y en retention_ends_at → 500 y nada cambia»
     (`it.each` con `failWrites` sobre las tres escrituras, creados **después** de preparar los datos: el alta del
     candidato ya escribe `retention_ends_at`): 500 `INTERNAL_ERROR` sin *stack*; 0 inscripciones, 0 `StageChange`, y
     `GET /api/candidates/:id` con la misma `retentionEndsAt` de antes.
   - «EC-18 el puerto de estado lanza → 500 y 0 filas» (`createJobStatusStub({ fail: true })` como `jobStatus`).
   - «EC-22 el puerto de procesos falla durante el recálculo → 500 y 0 inscripciones y 0 StageChange» (puerto que
     funciona en el alta del candidato y falla después, como el *togglingPort* de los tests de candidatos, pasado como
     `candidateProcesses`).
2. `apps/api/test/applications/privacy-logs.test.ts` (patrón de `apps/api/test/candidates/privacy-logs.test.ts`):
   «RNF-03 logs y errores sin nombre, email, teléfono ni nota en 404, 409 y los 500 del puerto de estado, del de
   procesos y del recálculo». Candidato con nombre, email y teléfono únicos inventados, y una inscripción `rejected` con
   nota; recorre 404 de oferta, 404 de candidato, 409 `INVALID_TRANSITION`, 409 `DUPLICATE` y los 3 500. En cada uno, ni
   el cuerpo ni ninguna línea de log contiene esos valores (EC-09, EC-24); el 409 `DUPLICATE` solo añade `existingId`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/enroll-failures-adversarial.test.ts` | crear | CA-11, EC-05, EC-18, EC-22, EC-52 |
| `apps/api/test/applications/privacy-logs.test.ts` | crear | RNF-03, EC-09, EC-24 |
| `apps/api/src/modules/applications/service.ts` | modificar solo si un test destapa un fallo | Arreglos, sin cambiar el contrato |

## Implementa
- RF: RF-01, RF-03, RF-04, RF-10 · RNF: RNF-03 · CA: CA-11 · Edge cases: EC-05, EC-09, EC-18, EC-22, EC-24, EC-52
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-05, EC-09, EC-18, EC-22, EC-24, EC-52), § Datos
  personales, DD-08, § Estrategia de tests (CA-11, RNF-03), § Checklist B-07

## Dependencias
- **Depende de:** TASK-04
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/enroll-failures applications/privacy-logs` en verde, con **2** ficheros de
      test.
- [ ] Si hubo arreglos: `npm test -w @ats/api -- applications` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/enroll-failures-adversarial.test.ts apps/api/test/applications/privacy-logs.test.ts`
      (más los ficheros de producción arreglados, si los hay) sin errores.
- [ ] Cada fichero de test ≤ 300 líneas tras Prettier.
- [ ] Commit único `test(api): enroll rollback on dependency failures and no personal data in logs [HU-04 TASK-08]`.

## Notas de implementación
- `failWrites` (`apps/api/test/helpers/test-app.ts`) crea triggers `fail_*` sobre la base de test: créalos tras el alta
  del candidato y de la oferta, o fallará la preparación.
- El manejador único (`apps/api/src/http/error-handler.ts`) registra el objeto de error solo en los 500; los errores de
  SQLite nombran columnas o expresiones del `CHECK`, no valores; el de `computeRetentionEndsAt` es fijo (DP-01). Los
  dobles lanzan `Error` con mensajes fijos sin datos personales.
- DD-08: `jobStatus?` existe en `buildApp` justo para este 500 con su línea de log.
- Datos inventados (`@example.com`, `+34 600 000 0xx`); la nota, inventada y no sensible.
