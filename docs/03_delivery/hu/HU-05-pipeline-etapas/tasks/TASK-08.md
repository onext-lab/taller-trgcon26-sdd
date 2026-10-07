# TASK-08 — Datos personales en logs y errores, y detalle frente a hostiles y fallos [adversarial]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02, RF-03)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
B-07 del diseño, en dos ficheros nuevos de `apps/api/test/applications/`:

1. **`stage-change-privacy.test.ts`** (RNF-04, RNF-05, CA-21, EC-09), con el patrón de captura de logs de
   `apps/api/test/applications/privacy-logs.test.ts` (logger en memoria, sin tocar ese fichero). Candidato inventado con
   nombre, email y teléfono únicos y una nota con un **marcador** inventado (p. ej. `MARCA-NOTA-7Q`):
   - rechazo con éxito, 400 por nota de 501 y 500 por fallo inyectado (`failWrites` en `stage_changes`): el marcador no
     aparece en ningún log, cuerpo de error, respuesta del rechazo ni en `GET /api/jobs/:jobId/applications`; **solo**
     en `GET /api/applications/:id`;
   - 404, 409 (`STAGE_MISMATCH` e `INVALID_TRANSITION`) y 500 de avanzar, rechazar y detalle: 0 apariciones de nombre,
     email o teléfono en logs y cuerpos.
2. **`detail-adversarial.test.ts`** (EC-19, EC-21, EC-22, EC-23):
   - **Input inválido (EC-19):** `:id` `abc`, `0` y `?x=1` → 400 (`{ field: 'id' }` o `{ field: 'querystring' }`).
   - **Fallo de dependencia (EC-21):** `createJobStatusStub({ failSummary: true })` → 500 sin datos; tabla `candidates`
     renombrada (`ALTER TABLE candidates RENAME TO candidates_x`) → 500 sin datos.
   - **Datos corruptos (EC-22):** con `PRAGMA foreign_keys = OFF` en el test, se borra el candidato de una inscripción →
     500 `INTERNAL_ERROR`, nunca un nombre inventado (DD-08).
   - **Seguridad (EC-23):** candidato con email, teléfono y nota → el detalle lleva nombre y nota y **0** claves
     `email` o `phone` en todo el JSON (búsqueda recursiva de claves).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/stage-change-privacy.test.ts` | crear | CA-21, RNF-04, RNF-05, EC-09 (logs y cuerpos) |
| `apps/api/test/applications/detail-adversarial.test.ts` | crear | EC-19, EC-21, EC-22, EC-23 |
| `apps/api/src/modules/applications/{service,routes}.ts` | modificar solo si un caso destapa un bug | Arreglo mínimo, citado en el commit |

## Implementa
- RF: RF-01, RF-02, RF-03 · CA: CA-21 · EC: EC-09, EC-19, EC-21, EC-22, EC-23 · RNF: RNF-04, RNF-05 · DD-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Datos personales, § Threat modeling (Exposición), DD-08, § Estrategia de
  tests (CA-21, RNF-04, EC-19 a EC-23), § Checklist B-07

## Dependencias
- **Depende de:** TASK-03, TASK-04, TASK-05
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/stage-change-privacy applications/detail-adversarial` en verde con **2**
      ficheros, con estos nombres: «CA-21 marcador de la nota ausente de logs, 400, 500, respuesta del rechazo y
      pipeline; presente solo en el detalle»; «RNF-04 nombre, email y teléfono ausentes de logs y cuerpos de 404, 409 y
      500 de avance, rechazo y detalle»; «EC-19 abc, 0, ?x=1 → 400»; «EC-21 getJobSummary lanza / candidates renombrada
      → 500 sin datos»; «EC-22 sin nombre → 500, sin inventarlo»; «EC-23 0 claves email ni phone».
- [ ] `npm test -w @ats/api -- applications/ module-boundaries` en verde con **27** ficheros (tras TASK-06 y TASK-07).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/stage-change-privacy.test.ts apps/api/test/applications/detail-adversarial.test.ts`
      (y producción si se toca) sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `test(api): personal data in logs and errors; hostile application detail [HU-05 TASK-08]`.

## Notas de implementación
- El manejador solo registra el objeto de error de los 500; los mensajes de SQLite nombran columnas, no valores. Si un
  log trajera la nota, es un bug de producción: se arregla aquí, no se adapta el test.
- Los textos internos de DD-08 (`'Inscripción sin candidato'`, `'Inscripción sin oferta'`) no llevan datos.
- Datos inventados (`@example.com`, `+34 600 000 0xx`); el marcador no es un dato personal.
- Si se ejecuta antes que TASK-06 o TASK-07 (en paralelo), el total de ficheros del criterio de regresión baja en 1 por
  cada una que falte.
