---
sprint: 01
objetivo: "Núcleo del ATS funcionando de principio a fin: ofertas con su ciclo de vida, candidatos con su consentimiento y retención, e inscripciones con su pipeline e historial."
inicio: 2026-10-06
fin: 2026-10-07            # por defecto, inicio + 1 (2 días)
estado: completado         # planificado | en curso | completado | cerrado
base: 2cd8752              # sha de main al abrir el sprint; /audit-sprint audita base..main
cerrado_en: 2026-10-07
audit-override: null       # solo con razón ≥ 20 caracteres
---

# sprint-01 (2026-10-06 - 2026-10-07)

## Objetivo
Al final del sprint, el reclutador crea, publica, cierra y duplica ofertas; da de alta, edita y busca candidatos con su
consentimiento y su fin de retención calculado; y los inscribe en ofertas publicadas y los lleva por el pipeline
(avance, rechazo e historial), con el cierre de una oferta rechazando sus inscripciones activas.

## Resumen de estado
- HU: hechas 6 / total 6 · en curso 0 · bloqueadas 0 · tareas sin HU: 7 / 7 (T-01 a T-07)
- **Cerrado el 2026-10-07.** Las 6 HU con review «Aprobado con observaciones» (HU-01 y HU-02 en la ronda 2, tras un «Requiere cambios»; HU-03 a HU-06 en la 1), mergeadas
  y con `/module-sync`; ofertas, candidatos e inscripciones al 100 % MVP. Auditoría del sprint «Aprobado con
  observaciones» (`docs/10_audits/sprints/sprint-01-AUDIT.md`, re-auditada tras T-06 y T-07). IDEA-001..003, FEAT-01..03
  y HU-01..06 archivadas en sus `completadas/`.

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

### HU-05 · Pipeline con cambio de etapa e historial · estado: hecha
- **Origen:** FEAT-03 · **Depende de:** HU-04 · **Rama:** `hu/HU-05-pipeline-etapas`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync

### HU-06 · Cerrar una oferta con inscripciones activas · estado: hecha
- **Origen:** FEAT-03 · **Depende de:** HU-05 · **Rama:** `hu/HU-06-cerrar-oferta-inscripciones-activas`
- [x] prd-writer
- [x] tech-design
- [x] task-planner
- [x] implementar-hu
- [x] reviewer
- [x] merge a main
- [x] module-sync
- **Nota:** `npm run db:reset` tras el merge, en cada portátil o base creada durante la ventana de INV-05 (lo hace cada
  persona, con Node 24 en el PATH). Hecho en la base de la rama de integración el 2026-10-07.

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

### T-05 · Historial inmutable también frente a `INSERT OR REPLACE` · estado: hecha
- **Tipo:** seguridad de datos (review de HU-04, SEC-09)
- Sin `recursive_triggers`, un `INSERT OR REPLACE` sobre un `StageChange` existente lo borra sin disparar
  `stage_changes_no_delete`. Activar `PRAGMA recursive_triggers = ON` al abrir la conexión
  (`apps/api/src/db/connection.ts`), o la alternativa que se justifique, con un test que demuestre que el `REPLACE`
  aborta. Tarea S obligatoria en `/audit-sprint`, antes de la etiqueta. Decisión del responsable técnico: el historial
  inmutable es lo que la feature A enseña en directo.

### T-06 · Ninguna aserción síncrona sobre lo que pone un efecto pasivo · estado: hecha
- **Tipo:** deuda de tests (auditoría del sprint, C-01 y A-01; prioridad alta del responsable técnico)
- El foco, `document.title` y el cierre de un `dialog` los pone un efecto pasivo, que corre después del commit: un test
  que los aserta en seguida falla a veces (EC-46 de HU-02 y `DeleteJobAction` EC-21 en este sprint). Primero la
  comprobación automática en `npm run check:harness` con su autoprueba (`scripts/check-passive-effects.mjs`) y la
  convención (`docs/07_architecture_principles/QUALITY-GATES.md` §4, `.claude/agents/web-builder.md`); después, el
  barrido de las 45 aserciones en este orden: las 5 negativas de título y la de `dialog`, el resto de títulos, el foco.
  Tope del responsable técnico: lo que no esté barrido a las 20:30 queda como excepción explícita y fechada de la
  comprobación (nunca desactivada) y pasa a paso-3.

### T-07 · Docs y kit al día tras la auditoría · estado: hecha
- **Tipo:** docs (auditoría del sprint, A-04, A-05, A-06 y A-08)
- Segunda aclaración fechada de DEC-06 (cuatro puertos y la dirección de cada uno); skills y agentes al día (DEC-06
  aclarado, puertos y `apps/api/test/module-boundaries.test.ts`); citas y docs de módulo de C-06, C-07 y los bajos de
  docs; y las tres cuestiones nuevas de `docs/RGPD.md` §7, sin resolverlas.

## Orden de ejecución
1. HU-01 (sin dependencias)
2. HU-02 (depende de HU-01)
3. HU-03 (sin dependencias; puede solaparse con HU-02 si no comparten ficheros)
4. HU-04 (depende de HU-02 y HU-03)
5. HU-05 (depende de HU-04)
6. HU-06 (depende de HU-05; en secuencia, porque toca su servicio de avanzar y rechazar)

## Recordatorio de reglas de oro
- Cero asunciones; ninguna etapa SDD se salta; brief obligatorio; integración ejecutada.
- Techo: 2 ciclos de arreglo por task y 2 «Requiere cambios» por HU.
- Ningún sprint se cierra sin `/audit-sprint` aprobado.

## Notas
- Ventana tolerada en `main` (HU-02), **cerrada con HU-06**: entre el merge de HU-04 y el de HU-06, cerrar una oferta
  con inscripciones activas la cerraba sin rechazarlas. Desde HU-06, INV-05 se cumple por construcción (CA-15, CA-16).
  Tras el merge de HU-06 hay que hacer `npm run db:reset`: una base creada durante la ventana puede tener ofertas
  cerradas con inscripciones abiertas.
- Para HU-04 (review de HU-03): un test que ate `CONSENT_VERSION` de la web con `CONSENT_TEXT_VERSION` de la API, y
  unificar los teléfonos del seed y de los tests en la serie `+34 600 000 0xx` (`docs/RGPD.md` §6).
- Los candidatos con la retención vencida siguen en el listado sin marca hasta la feature A (supresión y retención).
- 2026-10-06 · Decisión del responsable al revisar el PRD de HU-04: UC-18 · P y A1 (detalle de la inscripción con su
  historial: API y pantalla) pasan de HU-04 a HU-05, por el techo de 15 tareas de HU-04; HU-04 suma `ofertas` a sus
  módulos afectados (puerto de estado de la oferta en `jobs` y guarda de estado en su SQL, SEC-02).
- 2026-10-07 · Decisión del responsable («Sí, sprint de 6 HU»): por el techo de 15 tareas de
  `docs/07_architecture_principles/QUALITY-GATES.md` §2 (incluidas las adversariales), UC-19 y UC-04 · A1 salen de
  HU-05 y forman HU-06, «Cerrar una oferta con inscripciones activas», dentro de este sprint.
- 2026-10-07 · **Cierre del sprint** (decisiones del responsable técnico):
  - Deuda que pasa a **paso-3**, antes del ensayo del 15/10 y junto con los puntos de publicación (no hay sprint-02
    antes del taller; las features en vivo son A y C): A-02 (deuda de demo: integración en serie con e2e de *workers*
    acotados, *timeout* web justificado y medida en una máquina modesta), A-03 (umbral de 50 líneas por función: partir
    las factorías con `createXOperations` y medirlo con lint), A-07 (qué convenciones pasan a convención del repo) y
    A-10 (rutas absolutas de los briefs de HU-01 a HU-04 y su regla de `check-clean`).
  - Al backlog, opcional: A-09 (lista de `Host` permitidos en la guarda `onRequest`, SEC-S1).
  - Para la feature A, sin resolver: `docs/RGPD.md` §7, cuestiones 1 a 9.
  - Las 2 marcas `// efecto-síncrono:` de `apps/web/test/components/form-errors.test.ts:77` y `:89` (función pura que
    enfoca en la propia llamada) las **revisó y aprobó el responsable técnico el 2026-10-07**.
  - Regla nueva: quien implementa no rebaja la severidad de un hallazgo de su revisor; la propone y decide el
    responsable técnico (review de HU-06, DD-01).
  - Etiqueta `paso-2-sprint-01`: la pone el responsable técnico tras revisar el cierre.

## Traspaso (2026-10-07, 17:20)
- **Dónde se quedó:** sprint-01 cerrado en la rama de integración `worktree-paso-2-sprint-01`, commit
  `chore(sprint-01): cierre del sprint`, con el árbol limpio. `main` sigue en `fcce2b2` (T-02, base del paso 2): el
  avance de `main` por *fast-forward* lo decide el responsable técnico.
- **Siguiente paso exacto:**
  1. El responsable técnico revisa el cierre y pone la etiqueta local `paso-2-sprint-01` en el commit de cierre (o
     autoriza a la sesión a ponerla).
  2. *Fast-forward* de `main` hasta ese commit.
  3. paso-3, antes del ensayo del 15/10: A-02, A-03, A-07 y A-10 de la auditoría, junto con los puntos de publicación.
- **Avisos:**
  - `npm run db:reset` en cada base anterior a HU-06. Exige Node 24 en el PATH: con Node 20, `npm` lanza
    `node src/db/reset.ts` y falla con `node:sqlite`.
  - `npm run check:harness` incluye ahora `scripts/check-passive-effects.mjs`, con 0 excepciones y 2 marcas aprobadas.
    Una aserción síncrona nueva sobre foco, título o `dialog` lo pone en rojo.
  - Las ramas `hu/HU-01..06` siguen existiendo (todas mergeadas); se pueden borrar al publicar.
  - En algunos entornos de agente, `git` del sistema pide aceptar la licencia de Xcode y `check:harness` falla en
    `git ls-files`; con el `git` de Homebrew en el PATH pasa.
