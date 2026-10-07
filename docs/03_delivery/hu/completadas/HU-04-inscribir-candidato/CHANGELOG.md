# Changelog — HU-04 Inscribir en una oferta publicada, sin duplicados

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 1, `review/REVIEW.md`).
**Endpoints nuevos:** `POST /api/applications` y `GET /api/jobs/:jobId/applications`. `PATCH` y `DELETE` de ofertas
llevan la guarda de estado en el SQL (SEC-02).
**Pantallas:** «Ver pipeline» en la ficha de una oferta publicada; pipeline de la oferta (`/jobs/:id/pipeline`) con seis
columnas y el panel «Inscribir candidato»; la ficha del candidato muestra «Mientras dure el proceso».
**Migraciones:** `apps/api/src/db/migrations/003-create-applications.sql` (inscripciones e historial inmutable salvo
vaciar la nota). **Seed:** 40 inscripciones con su historial, además de las 10 ofertas y los 30 candidatos.

## Entradas

### 2026-10-07 — TASK-01 a TASK-09: inscripciones en la API
- **Tipo:** feature y test
- **Qué se entregó:** el reclutador inscribe un candidato en una oferta publicada (nunca en un borrador ni en una
  cerrada, y nunca dos veces la misma pareja); la inscripción nace en «recibida» con su primer cambio de etapa y la
  retención del candidato pasa a «mientras dure el proceso», todo o nada. El pipeline de una oferta devuelve sus
  inscripciones sin datos personales de más. Ya no se puede editar una oferta cerrada ni borrar una publicada aunque se
  cuele una petición a destiempo. El historial no se puede reescribir; solo se puede vaciar la nota (RGPD §5).
- **Archivos afectados:** `apps/api/src/modules/applications/*`, `apps/api/src/modules/jobs/{job-status,repository,service}.ts`,
  `apps/api/src/modules/candidates/{repository,service,processes-port}.ts`, `apps/api/src/app.ts`,
  `apps/api/src/db/{migrations/003-create-applications.sql,seed.ts,seed-candidates.ts,seed-applications.ts}`,
  `docs/07_architecture_principles/DECISIONS.md` y sus tests
- **Commit:** `a1e7b64`, `4a99223`, `bee8422`, `4eb138f`, `a15014e`, `0c996f0`, `babda45`, `1768242`, `c4e955c` ·
  después: `a626063`, `d0b2060`, `c488585`, `97ef784`
- **Desviaciones del PRD:** ninguna (PRD v1.1: excepción de la nota y «Página no encontrada»)

### 2026-10-07 — TASK-10 a TASK-14: inscripciones en la web
- **Tipo:** feature y test
- **Qué se entregó:** desde la ficha de una oferta publicada, «Ver pipeline» abre las seis columnas; el panel busca
  candidatos por nombre o email (hasta 10) e inscribe con un clic, con aviso de éxito, de duplicado o de oferta ya no
  publicada, y recarga el pipeline sin perder el panel. La búsqueda nunca va a la URL ni al historial del navegador.
- **Archivos afectados:** `apps/web/src/features/applications/*`, `apps/web/src/components/{use-resource.ts,StatusMessages.tsx}`,
  `apps/web/src/App.tsx`, `apps/web/src/features/jobs/JobActions.tsx`, `apps/web/src/styles.css` y sus tests
- **Commit:** `53296b3`, `d40ddd3`, `333068e`, `63584c6`, `0a44171` · después: `689dcbd`
- **Desviaciones del PRD:** ninguna (la tarjeta y el 409 van sin enlace hasta HU-05, DT-01, DT-02 y DT-04)

### 2026-10-07 — TASK-15: recorrido e2e
- **Tipo:** test
- **Qué se entregó:** 5 recorridos: inscribir de la oferta a la ficha del candidato, buscar por email, duplicado,
  pipeline de un borrador y de una cerrada, y privacidad de la búsqueda.
- **Archivos afectados:** `e2e/applications.spec.ts`
- **Commit:** `fb29fdf`
- **Desviaciones del PRD:** ninguna
