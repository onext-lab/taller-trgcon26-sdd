# Mapa de módulos — documentación ↔ código

**Catálogo autoritativo de módulos válidos** y resolutor de rutas del kit: lo usan `/anadir-idea` (valida
`modulos_afectados` contra esta tabla), `/feature-shaping`, `/prd-writer` (qué código leer), `/tech-design`,
`/task-planner`, `/reviewer`, `/module-sync` y los agentes `product-owner`, `feature-analyst` y los architects.

Las carpetas de código de cada módulo se crean con su primera HU; hasta entonces, solo existe la de documentación. Los
tres módulos tienen ya su código desde HU-04.

| Módulo (docs) | Módulo (código) | API | Web | Documentación | Entidades |
|---|---|---|---|---|---|
| `ofertas` | `jobs` | `apps/api/src/modules/jobs/` | `apps/web/src/features/jobs/` | `docs/05_modules/ofertas/` | `JobOpening` |
| `candidatos` | `candidates` | `apps/api/src/modules/candidates/` | `apps/web/src/features/candidates/` | `docs/05_modules/candidatos/` | `Candidate` |
| `inscripciones` | `applications` | `apps/api/src/modules/applications/` | `apps/web/src/features/applications/` | `docs/05_modules/inscripciones/` | `Application`, `StageChange` |

**Transversal** (no es módulo de negocio): `apps/api/src/app.ts`, `apps/api/src/server.ts`,
`apps/api/src/listen-options.ts`, `apps/api/src/logger.ts`, `apps/api/src/http/`, `apps/api/src/errors.ts`,
`apps/api/src/clock.ts`, `apps/api/src/db/` (incluido `apps/api/src/db/transaction.ts`), `apps/web/src/components/`,
`e2e/` y `scripts/`. Una HU que solo toca lo transversal declara `modulos_afectados: []`.

## Documentos de cada módulo

- `docs/05_modules/{módulo}/functional.md`: descripción funcional y estado vivo (lo mantiene `/module-sync`).
- `docs/05_modules/{módulo}/technical.md`: foto técnica para los architects (endpoints, tablas, componentes).
- `docs/05_modules/{módulo}/casos-de-uso/`: catálogo de casos de uso del módulo, un fichero `UC-NN-slug.md` por caso
  (plantilla `UC`, numeración global con `node scripts/next-id.mjs uc`) y el índice `README.md`. Los crea
  `/feature-shaping`; los citan por ID la HU, el PRD y la review; `/module-sync` mantiene su estado y el índice.
- La fila del módulo en [MVP-STATUS.md](MVP-STATUS.md).

## Mantenimiento

Un módulo nuevo se añade **a mano** a esta tabla (con confirmación de la persona), normalmente desde `/module-sync`
cuando una HU introduce un módulo que no estaba.
