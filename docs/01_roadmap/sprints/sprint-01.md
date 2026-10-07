---
sprint: 01
objetivo: "Núcleo del ATS funcionando de principio a fin: ofertas con su ciclo de vida, candidatos con su consentimiento y retención, e inscripciones con su pipeline e historial."
inicio: 2026-10-06
fin: 2026-10-07            # por defecto, inicio + 1 (2 días)
estado: en curso           # planificado | en curso | completado | cerrado
base: 2cd8752              # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: null
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-01 (2026-10-06 - 2026-10-07)

## Objetivo
Al final del sprint, el reclutador crea, publica, cierra y duplica ofertas; da de alta, edita y busca candidatos con su
consentimiento y su fin de retención calculado; y los inscribe en ofertas publicadas y los lleva por el pipeline
(avance, rechazo e historial), con el cierre de una oferta rechazando sus inscripciones activas.

## Resumen de estado
- HU: hechas 4 / total 5 · bloqueadas 0
- Última actualización: 2026-10-07 12:50 (HU-04 aprobada con observaciones en la ronda 1, mergeada y sincronizada; T-04 hecha; T-05 pendiente)

## Historias de usuario

### HU-01 · Crear, editar y consultar ofertas en borrador · estado: hecha
- **Origen:** FEAT-01 · **Depende de:** nada · **Rama:** `hu/HU-01-ofertas-borrador`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync

### HU-02 · Publicar, cerrar, duplicar y listar ofertas con filtros · estado: hecha
- **Origen:** FEAT-01 · **Depende de:** HU-01 · **Rama:** `hu/HU-02-ciclo-vida-ofertas`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync

### HU-03 · Alta, edición y búsqueda de candidatos, con consentimiento · estado: hecha
- **Origen:** FEAT-02 · **Depende de:** nada · **Rama:** `hu/HU-03-candidatos-consentimiento`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync

### HU-04 · Inscribir en una oferta publicada, sin duplicados · estado: hecha
- **Origen:** FEAT-03 · **Depende de:** HU-02 y HU-03 · **Rama:** `hu/HU-04-inscribir-candidato`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync

### HU-05 · Pipeline con cambio de etapa e historial · estado: pendiente
- **Origen:** FEAT-03 · **Depende de:** HU-04 · **Rama:** `hu/HU-05-pipeline-etapas`
- [ ] prd-writer
- [ ] tech-design
- [ ] task-planner
- [ ] implementar-hu
- [ ] reviewer
- [ ] merge a main
- [ ] module-sync

## Tareas sin HU

### T-01 · `engine-strict` para exigir Node 24 en `npm ci` · estado: hecha
- **Tipo:** infraestructura
- `.npmrc` con `engine-strict=true` y nota en `docs/SETUP.md`. Con Node 20, `npm ci` se para con `EBADENGINE`;
  con Node 24, instala. Origen: al empezar `/implementar-hu HU-01`, una terminal con Node 20 hacía fallar los
  tests de la API con «No such built-in module: node:sqlite».

### T-02 · Builders especializados `api-builder` y `web-builder` · estado: hecha
- **Tipo:** infraestructura (kit SDD)
- Dos agentes nuevos en `.claude/agents/` que sustituyen al builder genérico; el campo `Capa: api | web` en la
  plantilla de TASK, en `/task-planner` y en el brief decide cuál lanza `/implementar-hu` (R4.0 de
  `docs/IMPLEMENTATION-RULE.md`). Decisión de la persona responsable tras cerrar HU-01.

### T-03 · Tests web de ofertas intermitentes bajo carga · estado: hecha (`f888305`)
- **Tipo:** deuda de tests (HU-01/HU-02)
- `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` (foco en el h1),
  `apps/web/test/features/jobs/JobListScreen.pagination.test.tsx` (CA-18) y
  `apps/web/test/features/jobs/JobFormScreen.published.test.tsx` (EC-19) fallan a veces con varias suites o e2e en
  paralelo y pasan sueltos. Se arreglan esperando por estado (`findBy`/`waitFor`), sin tiempos fijos ni timeouts
  subidos. Hecho: la suite web completa 5 veces seguidas en verde con carga en paralelo. Origen: implementación de
  HU-03; decisión del responsable del taller (los portátiles de los asistentes serán más lentos).

### T-04 · Versión del consentimiento atada entre web y API, y teléfonos de ficción · estado: hecha
- **Tipo:** deuda de datos y tests (review de HU-03)
- Un test que falla si `CONSENT_VERSION` (`apps/web/src/features/candidates/consent.ts`) y `CONSENT_TEXT_VERSION`
  (`apps/api/src/modules/candidates/schemas.ts`) dejan de coincidir; y los teléfonos del seed y de los tests en la
  serie de ficción `+34 600 000 0xx` (`docs/RGPD.md` §6). Sale del PRD de HU-04 (era su RF-13) para adelgazarla;
  la copia local de `CandidateNotFound` sigue como deuda en `docs/05_modules/candidatos/technical.md`.

### T-05 · Historial inmutable también frente a `INSERT OR REPLACE` · estado: pendiente (bloquea la etiqueta)
- **Tipo:** seguridad de datos (review de HU-04, SEC-09)
- Sin `recursive_triggers`, un `INSERT OR REPLACE` sobre un `StageChange` existente lo borra sin disparar
  `stage_changes_no_delete`. Activar `PRAGMA recursive_triggers = ON` al abrir la conexión
  (`apps/api/src/db/connection.ts`), o la alternativa que se justifique, con un test que demuestre que el `REPLACE`
  aborta. Tarea S obligatoria en `/audit-sprint`, antes de la etiqueta. Decisión del responsable técnico: el historial
  inmutable es lo que la feature A enseña en directo.

## Orden de ejecución
1. HU-01 (sin dependencias)
2. HU-02 (depende de HU-01)
3. HU-03 (sin dependencias; puede solaparse con HU-02 si no comparten ficheros)
4. HU-04 (depende de HU-02 y HU-03)
5. HU-05 (depende de HU-04)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- Ventana tolerada en `main` (HU-02): entre el merge de HU-04 y el de HU-05, cerrar una oferta con inscripciones
  activas la cierra sin rechazarlas; INV-05 se cumple al entrar HU-05.
- Para HU-04 (review de HU-03): un test que ate `CONSENT_VERSION` de la web con `CONSENT_TEXT_VERSION` de la API, y
  unificar los teléfonos del seed y de los tests en la serie `+34 600 000 0xx` (`docs/RGPD.md` §6).
- Los candidatos con la retención vencida siguen en el listado sin marca hasta la feature A (supresión y retención).
- 2026-10-06 · Decisión del responsable al revisar el PRD de HU-04: UC-18 · P y A1 (detalle de la inscripción con su
  historial: API y pantalla) pasan de HU-04 a HU-05, por el techo de 15 tareas de HU-04; HU-04 suma `ofertas` a sus
  módulos afectados (puerto de estado de la oferta en `jobs` y guarda de estado en su SQL, SEC-02).
