# Flujo de trabajo — dual-track (Discovery → Delivery)

**Documento canónico del flujo del repo**: de una idea cruda al código integrado en `main`, qué skill se invoca en cada
paso, qué gate aplica y dónde queda el rastro. Los umbrales están en
[QUALITY-GATES.md](07_architecture_principles/QUALITY-GATES.md) y la forma de encargar e integrar código, en
[IMPLEMENTATION-RULE.md](IMPLEMENTATION-RULE.md).

```
DISCOVERY   1. IDEA → 2. SHAPING (FEAT) → 3. HU
DELIVERY    4. SPRINT → 5. SDD por HU (PRD → diseño → tareas → código → review → sync) → 5.bis AUDITORÍA → 6. CIERRE
```

**Modelo de trabajo.** Una **idea** se convierte en una **feature** resolviendo **todas** sus preguntas abiertas; la
feature se descompone en **historias de usuario (HU)**, y **la HU es la unidad del flujo SDD**: PRD, diseño, tareas,
código, review y sincronización de la documentación viven en la carpeta de cada HU (`docs/03_delivery/hu/HU-NN-slug/`).

## 0. Roles

| Quién | Qué hace |
|---|---|
| **La persona** (tú) | Decide el qué y el cuándo: responde las preguntas del shaping y del PRD, aprueba la feature, el diseño y el merge. |
| **La sesión de Claude Code** | Ejecuta las skills, lanza los agentes y pega la salida real de cada comando. |
| `product-owner` · `feature-analyst` | Discovery: ideas, shaping, HU y sprints. |
| `backend-architect` · `frontend-architect` | Diseño técnico de la HU (en paralelo si es fullstack). |
| `api-builder` · `web-builder` | Implementan una task con su brief, según su `Capa:` (`apps/api` · `apps/web` y `e2e/`). |
| `security-auditor` · `datos-personales-auditor` · `doc-code-drift-checker` | Auditores de solo lectura en la review y en la auditoría de sprint. |
| `qa-e2e-runner` | QA de un sprint en el navegador, contra local. |

## 1. Los seis pasos

### Paso 1 — Registrar ideas (`/anadir-idea`)
Captura cruda de una oportunidad o un problema; una idea por fichero, sin moldear.
- **Dónde:** `docs/02_discovery/ideas/NNN-slug.md` (id `IDEA-NNN`, plantilla `IDEA`).
- **Número:** `node scripts/next-id.mjs idea`, que recorre también `completadas/` y `descartadas/`.
- **Estado:** `idea | aceptada | descartada | completada`.

### Paso 2 — Shaping (`/feature-shaping IDEA-NNN`)
Convierte una idea en una **feature** con análisis funcional **sin asunciones** (agente `feature-analyst`).
- **Dónde:** `docs/02_discovery/features/FEAT-NN-slug/feature.md` (plantilla `FEATURE`).
- Resuelve actores, casos de uso, reglas de negocio, invariantes, casos límite y alcance. **Toda laguna es una
  pregunta**, no una suposición. Una decisión técnica nueva abre su `DEC-NN` en
  [DECISIONS.md](07_architecture_principles/DECISIONS.md).
- **Casos de uso:** cada uno es un fichero propio del catálogo del módulo,
  `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` (plantilla `UC`, número con `node scripts/next-id.mjs uc`),
  con flujo principal **P**, alternativos **A1…** y excepciones **E1…**, y su fila en el índice `README.md` del catálogo.
  La feature solo los lista. Viven en el módulo: sobreviven a la feature y no se mueven al cerrar el sprint.

### Paso 3 — Crear las HU
El agente `product-owner` trocea la feature según su *handoff*.
- **Dónde:** `docs/03_delivery/hu/HU-NN-slug/hu.md` (plantilla `HU`); número con `node scripts/next-id.mjs hu`.
- **Numeración global**: no se reinicia por feature ni por sprint, y los IDs no se reutilizan.
- Cada HU es **atómica** (se entrega sola), **vertical** (toca las capas necesarias) y **con valor**.
- Cada HU declara qué UC y qué flujos cubre (`UC-NN · P, A1, E1`); entre todas cubren todos los flujos de los UC de la
  feature, o dejan constancia de los que quedan fuera y por qué.

### Paso 4 — Sprint (`/crear-sprint`)
- **Dónde:** `docs/01_roadmap/sprints/sprint-NN.md` (plantilla `SPRINT`), con `### HU-NN · título` por HU.
- **Duración estándar: 2 días** (hoy y mañana); consulta la fecha real antes de fijarla.

### Paso 5 — Flujo SDD por HU (en `docs/03_delivery/hu/HU-NN-slug/`)
1. **`/prd-writer HU-NN`** → `specs/PRD.md`: el **qué**. Sale con 0 Open Questions.
2. **`/tech-design HU-NN`** → `plans/TECHNICAL_DOC.md` (o `-backend.md` + `-frontend.md`): el **cómo**. 0 Open Decisions.
3. **`/task-planner HU-NN`** → `tasks/ROADMAP.md` + `tasks/TASK-NN.md`: tareas atómicas por rebanada vertical.
4. **`/implementar-hu HU-NN`** → código y tests en la rama `hu/HU-NN-slug`, task a task, con **brief obligatorio**
   (`tasks/TASK-NN-BRIEF.md`) e **integración ejecutada**. Un commit por task; **2 ciclos de arreglo** como máximo.
5. **`/reviewer HU-NN`** → `review/REVIEW.md`: auditores en paralelo, tabla criterio → test y `VERDICT:` bloqueante.
   Como máximo **2 «Requiere cambios»** por HU; al tercero se para y se escala a la persona. Con la review aprobada y
   la integración en verde, **merge local** de `hu/HU-NN-slug` a `main`.
6. **`/module-sync HU-NN`** → `docs/05_modules/{módulo}/` y [MVP-STATUS.md](MVP-STATUS.md) al día, sobre `main`.

> **No se salta ninguna etapa**, ni en HU pequeñas: PRD, diseño y tareas cuestan minutos y ahorran horas de re-trabajo.

### Paso 5.bis — Auditoría de sprint (`/audit-sprint NN`)
Con todas las HU del sprint hechas y su review aprobada: 2 dimensiones con 3 auditores (código:
`doc-code-drift-checker` más la revisión de calidad de la skill; seguridad y datos personales: `security-auditor` y
`datos-personales-auditor`) sobre el
**diff consolidado del sprint**. Captura lo que la review por HU no ve: interacciones entre HU, seguridad acumulada y
drift. **Fail-closed**: una dimensión no concluida nunca da `Aprobado`. Opcional antes: **`/qa-e2e NN`** en local.

### Paso 6 — Cerrar el sprint (`/cerrar-sprint NN`)
Con la auditoría en `VERDICT` ≠ `Bloqueado` (o `audit-override: <razón ≥ 20 caracteres>` en el sprint):
- Mueve a `completadas/` los **tres niveles** entregados (idea, feature y HU); lo parcial se queda en su sitio.
- La HU se mueve **siempre después de `/module-sync`**, para no romper rutas.
- Marca el sprint como `cerrado`.

## 2. Visión de conjunto

```
── DISCOVERY ──
/anadir-idea ────────► docs/02_discovery/ideas/NNN-slug.md
/feature-shaping ────► docs/02_discovery/features/FEAT-NN-slug/feature.md   (preguntas → persona; cero asunciones)
                       + docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md (catálogo del módulo)
product-owner ───────► docs/03_delivery/hu/HU-NN-slug/hu.md
/crear-sprint ───────► docs/01_roadmap/sprints/sprint-NN.md
── DELIVERY · SDD POR HU (rama hu/HU-NN-slug) ──
/prd-writer ─────────► specs/PRD.md (Ready)
/tech-design ────────► plans/TECHNICAL_DOC*.md   ◄── backend-architect ∥ frontend-architect
/task-planner ───────► tasks/ROADMAP.md + TASK-NN.md
/implementar-hu ─────► brief + builder por task · integración · un commit por task  ◄── api-builder | web-builder
/reviewer ───────────► review/REVIEW.md   ◄── security-auditor ∥ datos-personales-auditor ∥ doc-code-drift-checker
merge local ─────────► hu/HU-NN-slug → main (review aprobada + integración en verde)
/module-sync ────────► docs/05_modules/** + MVP-STATUS.md
── CIERRE ──
/qa-e2e NN (opcional) ► docs/10_audits/qa/sprint-NN-AAAA-MM-DD/index.html
/audit-sprint NN ────► docs/10_audits/sprints/sprint-NN-AUDIT.md
/cerrar-sprint NN ───► idea → feature → HU a completadas/ · sprint cerrado
```

## 3. Tabla por paso

| Paso | Skill | Agente(s) | Gate | Rastro |
|---|---|---|---|---|
| Idea | `/anadir-idea` | — | id único (`next-id`) | `ideas/NNN-slug.md` |
| Shaping | `/feature-shaping` | `feature-analyst` | 6 dimensiones; 0 preguntas abiertas; aprueba la persona | `features/FEAT-NN-slug/feature.md` |
| HU | — | `product-owner` | atómica, vertical, con valor | `hu/HU-NN-slug/hu.md` |
| Sprint | `/crear-sprint` | — | — | `sprints/sprint-NN.md` |
| PRD | `/prd-writer` | — | RNF medibles; ≥3 edge cases por RF Must; 0 OQ | `specs/PRD.md` |
| Diseño | `/tech-design` | architects | secciones 🔒; 0 OD; todos los RF cubiertos | `plans/TECHNICAL_DOC*.md` |
| Tareas | `/task-planner` | — | ≤ 15 tasks de ≤ 4 h; ficheros concretos | `tasks/` |
| Código | `/implementar-hu` | `api-builder` · `web-builder` (por capa) | integración en verde; ≤ 2 ciclos | commits en `hu/HU-NN-slug` |
| Review | `/reviewer` | 3 auditores | `VERDICT` ≠ Requiere cambios; ≤ 2 rondas | `review/REVIEW.md` |
| Merge | — | — | review aprobada + integración en verde | `main` |
| Sync | `/module-sync` | — | rutas citadas existen | `05_modules/**`, `MVP-STATUS.md` |
| Auditoría | `/audit-sprint` | 2 dimensiones, 3 auditores | fail-closed | `10_audits/sprints/` |
| Cierre | `/cerrar-sprint` | — | auditoría aprobada u override | `completadas/` |

## 4. IDs y trazabilidad

| ID | Qué es | Dónde vive |
|---|---|---|
| `IDEA-NNN` | Idea cruda | `docs/02_discovery/ideas/NNN-slug.md` |
| `FEAT-NN` | Feature analizada | `docs/02_discovery/features/FEAT-NN-slug/feature.md` |
| `HU-NN` | Historia de usuario (unidad SDD) | `docs/03_delivery/hu/HU-NN-slug/` |
| `sprint-NN` | Contenedor de 2 días | `docs/01_roadmap/sprints/sprint-NN.md` |
| `T-NN` | Task de sprint sin HU (infra, spike) | sección `### T-NN` del sprint |
| `TASK-NN` | Task implementable (numerada dentro de la HU) | `docs/03_delivery/hu/HU-NN-slug/tasks/` |
| `SPIKE-NN` | Investigación con timebox | `docs/02_discovery/spikes/SPIKE-NN-slug.md` |
| `DEC-NN` | Decisión de arquitectura | [DECISIONS.md](07_architecture_principles/DECISIONS.md) |
| `UC-NN` | Caso de uso (flujos P, A1…, E1…) | `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` |
| `CA-NN` | Criterio de aceptación (numerado dentro del PRD) | `specs/PRD.md` de la HU |

Todos los números salen de `node scripts/next-id.mjs <idea|feat|spike|sprint|hu|task|uc>`, nunca a mano.

**Trazabilidad de los casos de uso:** `UC-NN · flujo` → HU que lo cubre → **al menos un `CA-NN` en el PRD por flujo**
(los alternativos y las excepciones son criterios de aceptación, no solo edge cases) → test en la tabla criterio → test
de `REVIEW.md`, con columna UC. **Un UC o un flujo cubierto sin test es un hallazgo crítico.** `/module-sync` marca el UC
`implementado` y completa su tabla de trazabilidad. Los UC se citan por ID y ruta desde la raíz, sin enlace relativo.

**Git.** Cada skill deja el árbol limpio con su propio commit, nombrando ficheros (nunca `git add -A`):
- **Discovery, en `main`:** `/anadir-idea` (la idea), `/feature-shaping` (feature, UC e índices), `product-owner` (las
  `hu.md`) y `/crear-sprint` (el sprint).
- **Especificación, en la rama de la HU:** `/prd-writer` crea `hu/HU-NN-slug` desde `main` y comitea el PRD;
  `/tech-design` y `/task-planner` comitean en esa rama el diseño y las tareas.
- **Código:** `/implementar-hu`, un commit por task, en inglés y con el ID (`feat(jobs): add publish endpoint
  [HU-02 TASK-03]`); `/reviewer` comitea la review y, si aprueba con la integración en verde, merge **local** a `main`.
- **Cierre, en `main`:** `/module-sync`, `/audit-sprint` y `/cerrar-sprint`.

**Sin remoto, sin push y sin despliegue**: todo corre en el portátil. Cada HU cita su `FEAT-NN` y cada feature, su
`IDEA-NNN`.

## 5. Definition of Done por etapa

| Etapa | Definition of Done | Gate bloqueante |
|---|---|---|
| Idea | Frontmatter completo, problema u oportunidad, alcance a grano grueso | — |
| Shaping | 6 dimensiones resueltas sin asunciones; UC en el catálogo con P, A y E; preguntas cerradas | Aprobación de la persona |
| HU | Atómica, vertical, con valor; `FEAT-NN` citado; UC y flujos cubiertos; criterios de aceptación | Descomposición acordada |
| PRD | `Ready`; 0 Open Questions; cada flujo de UC cubierto con ≥1 CA; RNF medibles; ≥3 edge cases por RF Must | — |
| Diseño | Secciones 🔒 completas o `N/A — razón`; cobertura de todos los RF; 0 Open Decisions | Visto bueno de la persona |
| Tareas | Ficheros concretos; ≤ 15 tasks de ≤ 4 h; task adversarial por RF Must | — |
| Código | Tasks `Completada`; integración en verde con la salida real pegada | Tests + typecheck + lint |
| Review | Auditores concluidos; criterio ↔ test con columna UC; `VERDICT:`; merge local a `main` | `VERDICT` ≠ Requiere cambios |
| Sync | Docs de módulo, catálogo de UC y `MVP-STATUS.md` al día con reemplazos, no *appends* | Rutas citadas existen |
| Auditoría | 2 dimensiones sobre el diff del sprint; fail-closed | `VERDICT` ≠ Bloqueado |
| Cierre | 3 niveles en `completadas/` (HU tras el sync) | Auditoría aprobada u override |

## 6. Cuándo invocar cada agente

Los agentes los lanzan las skills; se invocan a mano solo para consultas puntuales.

| Agente | Lo lanza | Úsalo a mano para |
|---|---|---|
| `product-owner` | — (lo invoca la persona) | trocear una feature en HU, priorizar o actualizar el estado del sprint |
| `feature-analyst` | `/feature-shaping` | — |
| `backend-architect` · `frontend-architect` | `/tech-design` | dudas de diseño sobre una HU con PRD `Ready` |
| `api-builder` · `web-builder` | `/implementar-hu` (uno por task, según `Capa:`) | — |
| `security-auditor` · `datos-personales-auditor` | `/reviewer`, `/audit-sprint` | revisar un cambio sensible antes de la review |
| `doc-code-drift-checker` | `/reviewer`, `/module-sync`, `/audit-sprint` | comprobar que las rutas citadas en docs existen |
| `qa-e2e-runner` | `/qa-e2e` | — |

## 7. Recetas cortas

**A) HU fullstack (lo normal en el ATS)**
```
/prd-writer HU-NN → /tech-design HU-NN (backend ∥ frontend) → /task-planner HU-NN
/implementar-hu HU-NN → /reviewer HU-NN → merge local a main → /module-sync HU-NN
```

**B) HU con datos personales** (candidatos): igual que A, pero el PRD declara qué datos, para qué y cuánto tiempo, y
la review exige `datos-personales-auditor` sin hallazgos críticos. Base: [RGPD.md](RGPD.md).

**C) Spike** (no sabes si te quedarás con el código): no abras SDD. Crea `docs/02_discovery/spikes/SPIKE-NN-slug.md`
(plantilla `SPIKE`) con pregunta, hipótesis, criterios y timebox; la prueba va en una rama `spike/…` que no se integra.

## 8. Reglas de oro

1. **Toda HU nace de una `FEAT-NN`, que nace de una `IDEA-NNN`.** Sin feature analizada no se arranca SDD.
2. **La HU es la unidad de trabajo**, no la feature; una HU que no se puede demostrar funcionando está mal partida.
3. **El paso 5 no se salta**, ni en HU pequeñas.
4. **Cero asunciones**: toda laguna es una pregunta para la persona.
5. **Numeración global** con `next-id`; los IDs no se reutilizan ni se renumeran.
6. **Techo de 2 ciclos de arreglo** por task y de 2 «Requiere cambios» por HU; al siguiente, se para y se escala.
7. **Sin push, sin remoto, sin red** salvo `npm ci` y la instalación de Chromium. **Datos inventados** siempre.
8. **Nunca** `git add -A`, `git add .` ni `git stash`: se añade nombrando ficheros.
9. **Idioma:** docs en castellano de España; código, identificadores y commits en inglés.

## 9. Cuándo NO seguir este flujo

- **Infraestructura sin valor de usuario directo**: task sin HU (`T-NN`), con un commit claro y las verificaciones en
  verde. **Ejemplo de este repo: el esqueleto del monorepo** (workspaces, `GET /api/health`, un test por app y el
  smoke de Playwright) entró como un commit de infraestructura, sin idea, feature ni HU, porque no hay nada que
  preguntar ni que aceptar: o arranca y pasa las verificaciones, o no.
- **Fixes de una línea** o cambios cosméticos: directo, en una rama corta, con las verificaciones en verde.
- **Refactors internos sin cambio de contrato**: task sin HU con brief e integración; sin PRD.
- **Spikes**: receta C.

## 10. Etiquetas por fase

El repo se recorre en el taller saltando entre etiquetas git **locales**. Cada una se crea con `test`, `typecheck`,
`lint`, `e2e` y `check:harness` en verde.

| Etiqueta | Qué contiene |
|---|---|
| `paso-0-kit` | El kit SDD (`.claude/`, `docs/`, `AGENTS.md`, `CLAUDE.md`) y el esqueleto del monorepo |
| `paso-1-discovery` | Ideas, features y HU del núcleo del ATS, con sus preguntas y respuestas visibles |
| `paso-2-sprint-01` | El sprint 01 entregado: PRD → diseño → tareas → código → review → sync, auditoría y cierre |
| `paso-3-punto-de-partida` | README y `SETUP.md` revisados: lo que recibe cada asistente |
| `vivo-{A,C}-1-feature` | Feature en vivo (A: supresión y retención RGPD; C: importación CSV) tras el shaping |
| `vivo-{A,C}-2-prd` | La misma feature con su HU y su PRD `Ready` |
| `vivo-{A,C}-3-tareas` | Con diseño técnico y tareas |
| `vivo-{A,C}-4-hecho` | Implementada, revisada y sincronizada: la solución de referencia |

Para saltar: `git switch --detach <etiqueta> && npm ci && npm run db:reset`.

## Referencias

- [IMPLEMENTATION-RULE.md](IMPLEMENTATION-RULE.md) · [QUALITY-GATES.md](07_architecture_principles/QUALITY-GATES.md) ·
  [DECISIONS.md](07_architecture_principles/DECISIONS.md) · [plantillas](_templates/) · [mapa de docs/](README.md).
- Skills en `.claude/skills/`; agentes en `.claude/agents/`; hooks en `.claude/hooks/`.
