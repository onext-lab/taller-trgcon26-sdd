# TASK-09 — Pipeline e integridad de la base frente a hostiles [adversarial]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (adversarial de RF-02, RF-05 y RF-11)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
B-08 del TD. Ataca la lectura del pipeline y la base saltándose el servicio. Si un test destapa un fallo, se arregla en
producción (sin adaptar el test).

1. `apps/api/test/applications/pipeline-adversarial.test.ts`:
   - «EC-26 jobId abc, 0, 01, 16 dígitos y ?foo=1 → 400» (`details` con `{ field: 'jobId' }` o
     `{ field: 'querystring' }`);
   - «EC-29 error de la base al leer → 500 en el envelope sin SQL ni stack» (tabla `applications` renombrada en la
     base del test);
   - «EC-30 con teléfono y nota en la base: 0 claves y 0 valores de email, teléfono o nota» (candidatos con teléfono y
     una `rejected` con nota; se busca en el JSON serializado de la respuesta).
2. `apps/api/test/applications/integrity-adversarial.test.ts` (`INSERT`/`DELETE` directos):
   - «EC-14 segundo INSERT directo de la misma pareja → falla el índice único»;
   - «EC-15 DELETE de un candidato y de una oferta con inscripciones → falla la FK RESTRICT» (las filas siguen);
   - INV-04: un salto (`received → interview`), un retroceso (`screening → received`), una salida de etapa final
     (`hired → rejected`), un segundo inicial (`stage_changes_one_initial_uq`) y un segundo final
     (`stage_changes_one_final_uq`) → fallan;
   - INV-07 e INV-10: un `rejected` sin motivo y una nota vacía (`''`) o en un destino no `rejected` → fallan;
   - **RF-11 sobre la base sembrada** (`seed(db, NOW)`): un `INSERT` directo que viola INV-04 o INV-07 en una inscripción
     del seed falla y los recuentos siguen en 40 inscripciones.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/pipeline-adversarial.test.ts` | crear | EC-26, EC-29, EC-30 |
| `apps/api/test/applications/integrity-adversarial.test.ts` | crear | EC-14, EC-15 (FK), INV-04, INV-07, INV-10, seed (RF-11) |
| `apps/api/src/modules/applications/repository.ts` · `apps/api/src/modules/applications/service.ts` · `apps/api/src/modules/applications/routes.ts` · `apps/api/src/modules/applications/schemas.ts` | modificar solo si un test destapa un fallo | Arreglos, sin cambiar el contrato |

## Implementa
- RF: RF-02, RF-05, RF-11 · RNF: RNF-04 · Edge cases: EC-14, EC-15, EC-26, EC-29, EC-30, EC-55 (protección del seed)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos, § Error paths (EC-14, EC-15, EC-26, EC-29, EC-30),
  § Estrategia de tests › Adversariales, § Checklist B-08

## Dependencias
- **Depende de:** TASK-05 (pipeline), TASK-06 (seed)
- **Bloquea:** TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/pipeline-adversarial applications/integrity-adversarial` en verde, con **2**
      ficheros de test.
- [ ] `npm test -w @ats/api` completo en verde (última tarea de la API).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/pipeline-adversarial.test.ts apps/api/test/applications/integrity-adversarial.test.ts`
      (más los ficheros de producción arreglados, si los hay) sin errores.
- [ ] Cada fichero de test ≤ 300 líneas tras Prettier.
- [ ] Commit único `test(api): pipeline and database integrity against hostile input [HU-04 TASK-09]`.

## Notas de implementación
- No dupliques lo de TASK-01: EC-12 (etapa `foo`, motivo en `screening`, nota de 501), EC-13 y los triggers ya están en
  `migration.test.ts` y `migration-triggers.test.ts`. Aquí van la FK, los índices únicos y la tabla de transiciones.
- `PRAGMA foreign_keys = ON` lo pone `openDatabase`; en una base abierta de otra forma la FK no se comprobaría.
- Para EC-29, renombra la tabla en la base del test **después** de crear la app; el 500 lo produce el manejador único.
- En RNF-04, el `response` schema de TASK-05 filtra lo no declarado; el test lo comprueba con datos reales en la base.
