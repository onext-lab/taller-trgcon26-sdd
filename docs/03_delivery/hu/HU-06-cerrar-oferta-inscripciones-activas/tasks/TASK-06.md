# TASK-06 — Rendimiento del cierre con 200 activas y de la previa (RNF-01, RNF-02)

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** test (backend)
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RNF-01, RNF-02; EC-09 con 200)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Mide el coste lineal del rechazo fila a fila (DD-02: 2N sentencias + N recálculos) con los volúmenes del PRD.

Crea `apps/api/test/applications/close-performance.test.ts` siguiendo el patrón de
`apps/api/test/applications/performance.test.ts` (inserción directa con `insertApplicationWithHistory`, ofertas y
candidatos por repositorio dentro de `withTransaction`, `performance.now()` alrededor de `app.inject`):

- **Volumen:** 1 000 candidatos y 2 000 inscripciones en total; al menos **4** ofertas `published` con **200**
  inscripciones activas cada una (etapas no finales repartidas entre `received`, `screening`, `interview` y `offer`) y
  el resto repartido en otras ofertas con etapas mezcladas. Cada candidato, como mucho una inscripción por oferta
  (`applications_candidate_job_uq`).
- **RNF-02:** 3 previas (`GET /api/jobs/:id/close-preview`) de ofertas con 200 activas: cada respuesta 200 con
  `{ activeApplications: 200 }` y `max < 200 ms`.
- **RNF-01:** 3 cierres (`POST /api/jobs/:id/close`), **cada uno de una oferta distinta** con 200 activas: cada
  respuesta 200 y `max < 500 ms`; tras cada cierre, 0 no finales en esa oferta.
- Un calentamiento previo (una previa y un cierre sobre una cuarta oferta, sin medir) para no medir la primera
  compilación de sentencias.

**Regla de parada (DT-02, responsable técnico).** Si RNF-01 **no baja de 500 ms**, el builder **para y escala** al
responsable técnico con la salida real (tiempos de las 3 repeticiones) **antes de optimizar nada**: no se cambia
`job-closing.ts`, ni `recalculateRetention`, ni se sube el umbral, ni se marca el test como `skip`. La tarea queda
`Bloqueada` hasta su respuesta.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/applications/close-performance.test.ts` | crear | RNF-01 (3 cierres de 200 activas, `max < 500`) y RNF-02 (3 previas, `max < 200`) |

## Implementa
- RNF: RNF-01, RNF-02 · RF-02 (EC-09 con 200), RF-01 y RF-03 (coste del rechazo dentro del cierre)
- Diseño: `plans/TECHNICAL_DOC-backend.md` DD-02, § Threat modeling (denegación de servicio), § Estrategia de tests
  (`close-performance.test.ts`), § Riesgos (RNF-01), § Checklist 6

## Dependencias
- **Depende de:** TASK-02
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/api -- applications/close-performance` en verde con **1** fichero y estos tests:
  - `RNF-01 cierre con 200 activas < 500 ms` (3 ofertas distintas; `max` de las 3 contra el umbral).
  - `RNF-02 previa con 200 activas < 200 ms` (3 repeticiones; `max` contra el umbral).
- [ ] La salida real de los tiempos (las 3 de cada) queda en el informe del builder.
- [ ] Si RNF-01 ≥ 500 ms: tarea `Bloqueada` y escalado al responsable técnico, sin optimizar (DT-02).
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función nueva de 50 (`wc -l` tras Prettier).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/close-performance.test.ts` sin errores.
- [ ] Commit único `test(api): job close and close-preview performance with 200 active applications [HU-06 TASK-06]`
      con el fichero.

## Notas de implementación
- **Ejecútalo sin otros builders corriendo tests a la vez**: la competencia por CPU puede dar un falso > 500 ms y
  disparar la escalada. Si sale cerca del umbral, repítelo una vez a solas y pega las dos salidas.
- El reloj del cierre (`createTestClock`) tiene que ser posterior a todos los `created_at` y `last_change_at`
  insertados (`CHECK last_change_at >= created_at`).
- No reutilices `performance.test.ts` (186 líneas, de HU-05): fichero hermano nuevo, como dice el TD.
- Datos inventados, generados en bucle (`Candidata Rendimiento NNNN`, `rendimiento.NNNN@example.com`).
