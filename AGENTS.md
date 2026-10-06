# AGENTS.md — ATS de ejemplo del taller de SDD

ATS ficticio de RR. HH. (ofertas, candidatos e inscripciones) para enseñar **Spec-Driven Development** con agentes:
de una idea al código integrado, con especificaciones, gates comprobables y verificación ejecutada. Un único rol,
«reclutador», sin login. Todos los datos son **inventados**.

## Stack

- npm workspaces: `apps/api` (Fastify 5 + `node:sqlite` sobre `data/ats.db`), `apps/web` (React 19 + Vite),
  `e2e/` (Playwright, solo Chromium). TypeScript estricto. **Node 24 LTS ≥ 24.15** (`docs/SETUP.md`).
- Decisiones de arquitectura: `docs/07_architecture_principles/DECISIONS.md` (`DEC-NN`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm ci` · `npx playwright install chromium` | Instalar dependencias y el navegador de los e2e |
| `npm run db:reset` | Regenerar `data/ats.db` (esquema + migraciones + seed) |
| `npm run dev` | API en :3001 y web en :5173 (proxy `/api`) |
| `npm test` · `npm run typecheck` · `npm run lint` · `npm run e2e` | Verificaciones |
| `npm test -w apps/api -- <patrón>` · `npx eslint <ficheros>` | Verificaciones acotadas |
| `npm run check:env` · `npm run check:harness` | Portátil listo · kit SDD completo |
| `node scripts/next-id.mjs <idea\|feat\|spike\|sprint\|hu\|task>` | Siguiente ID libre (nunca a mano) |

## El flujo (detalle en `docs/WORKFLOW.md`)

1. **Idea** → `/anadir-idea` → `docs/02_discovery/ideas/NNN-slug.md`
2. **Feature** → `/feature-shaping IDEA-NNN` → `FEAT-NN-slug/feature.md`, sin asunciones: toda laguna es una pregunta.
   Sus casos de uso van al catálogo del módulo (`docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md`, flujos P/A/E):
   cada flujo cubierto por una HU es ≥1 criterio de aceptación del PRD y un test en la review
3. **HU** → agente `product-owner` → `docs/03_delivery/hu/HU-NN-slug/hu.md`; **sprint** → `/crear-sprint`
4. **Por HU** (rama `hu/HU-NN-slug`): `/prd-writer` → `/tech-design` → `/task-planner` → `/implementar-hu`, que
   lanza un builder por task según su `Capa:` (`api-builder` para `apps/api`; `web-builder` para `apps/web` y `e2e/`)
5. **Cierre de HU**: `/reviewer` (`VERDICT:`) → merge local a `main` → `/module-sync`
6. **Cierre de sprint**: `/qa-e2e` (opcional) → `/audit-sprint` → `/cerrar-sprint`

## Reglas de oro

- **Sin push, sin remotos, sin red** (salvo `npm ci` y la instalación de Chromium). Ni `curl` ni `wget`.
- **Datos inventados** siempre: nunca CVs ni personas reales. Datos personales según `docs/RGPD.md`.
- **Cero asunciones**: si falta información, se pregunta a la persona.
- **No se salta ninguna etapa** del paso 4, ni en HU pequeñas.
- **Integración ejecutada**: tests, typecheck y lint con la salida real pegada (`docs/IMPLEMENTATION-RULE.md`).
- **Techo de 2 ciclos** de arreglo por task y de 2 «Requiere cambios» por HU; al siguiente, se para y se escala.
- **Un commit por task**, en inglés y con el ID (`[HU-NN TASK-NN]`). Nunca `git add -A`, `git add .` ni `git stash`.
- **Nunca leas ni escribas `.env*`** ni credenciales. Docs en castellano de España; código en inglés.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Mapa de la documentación | `docs/README.md` |
| Gates y umbrales · regla de implementación | `docs/07_architecture_principles/QUALITY-GATES.md` · `docs/IMPLEMENTATION-RULE.md` |
| Arquitectura · módulos docs ↔ código | `docs/ARCHITECTURE.md` · `docs/_modules.md` |
| Estado por módulo | `docs/MVP-STATUS.md` y `docs/05_modules/{módulo}/` |
| Plantillas de los artefactos | `docs/_templates/` |
| Skills · agentes · hooks | `.claude/skills/` · `.claude/agents/` · `.claude/hooks/` |
| Código | `apps/api/src/`, `apps/web/src/`, `e2e/` |
