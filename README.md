# Taller SDD · ATS de ejemplo

Repo de ejemplo del taller de **Spec-Driven Development** (TRGCON 2026): un ATS ficticio de RR. HH. (ofertas,
candidatos e inscripciones) construido con un flujo de agentes en Claude Code, de la idea al código integrado, con
especificaciones, gates comprobables y verificación ejecutada. Todos los datos son inventados.

> **Ejemplo archivado, sin soporte.** Este repo es material del taller: se archiva el **2026-12-31** y no recibe cambios,
> incidencias ni pull requests. Este kit es un ejemplo didáctico derivado del flujo SDD de onext.

## Qué hay dentro

- **El ATS:** API en Fastify 5 con el SQLite de Node (`node:sqlite`), web en React 19 + Vite y e2e con Playwright.
  Un único rol, «reclutador», sin login.
- **El kit SDD:** skills, agentes y hooks de Claude Code (`.claude/`) y la documentación del flujo (`docs/`).
- **El rastro completo de un sprint:** ideas, features, casos de uso, HU con su PRD, su diseño, sus tareas, su review y
  la auditoría del sprint. Cada regla de negocio se sigue hasta su test.

## Requisitos

- **Node 24 LTS (≥ 24.15)**, npm y git.
- El Chromium de Playwright, solo para los e2e (`npx playwright install chromium`).
- Puertos 3001 y 5173 libres.
- **No hace falta ninguna clave de IA** para arrancar el ATS, pasar los tests ni recorrer las etiquetas: el producto
  no llama a ningún modelo. Claude Code solo hace falta si quieres repetir el flujo tú mismo.

Detalle, motivos y cómo instalar Node 24: [docs/SETUP.md](docs/SETUP.md).

## Arranque en 3 comandos

```bash
npm ci
npx playwright install chromium
npm run db:reset && npm run dev
```

Abre <http://127.0.0.1:5173> y comprueba que pone «Estado de la API: ok». Para revisar el portátil antes del taller: `npm run check:env`.

## Recorrer el taller por etiquetas

El repo se sigue saltando entre etiquetas git, una por fase:

| Etiqueta | Qué ves |
|---|---|
| `paso-0-kit` | El kit SDD y el esqueleto del monorepo (solo `/api/health`) |
| `paso-1-discovery` | Ideas, features, casos de uso y HU del núcleo, con sus preguntas y respuestas; aún sin código de negocio |
| `paso-2-sprint-01` | El sprint 01 entregado: 6 HU de PRD a código, con reviews, auditoría y cierre |
| `paso-3-punto-de-partida` | Este README, el guion y `SETUP.md`: el punto de partida del taller |
| `vivo-{A,C}-{1-feature,2-prd,3-tareas,4-hecho}` | Las features en vivo (A: supresión y retención RGPD; C: importación CSV), fase a fase |

```bash
git switch --detach paso-1-discovery && npm ci && npm run db:reset
```

Cómo volver, qué cambia entre etiquetas y los problemas típicos: [docs/SETUP.md](docs/SETUP.md#recorrer-el-taller-por-etiquetas).

## Dónde empezar

- [AGENTS.md](AGENTS.md): el repo en una página (comandos, flujo y reglas de oro).
- [docs/WORKFLOW.md](docs/WORKFLOW.md): el flujo completo.
- [docs/README.md](docs/README.md): el mapa de la documentación.

## Licencias

El código, los tests, los scripts, el kit de Claude Code (`.claude/`, `AGENTS.md`, `CLAUDE.md`) y las plantillas de
`docs/_templates/` van bajo [MIT](LICENSE). La prosa de `docs/` y este README, bajo CC BY 4.0. El mapa ruta a ruta y la
atribución están en [NOTICE](NOTICE). Titular: onext technology.
