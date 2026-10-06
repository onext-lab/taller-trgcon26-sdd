# Mapa de `docs/`

Todo lo que el flujo SDD escribe o consulta vive aquí. Empieza por [WORKFLOW.md](WORKFLOW.md) (el flujo) o por
[00_methodology/README.md](00_methodology/README.md) (el flujo en una página).

## Raíz

| Fichero | Qué es |
|---|---|
| [WORKFLOW.md](WORKFLOW.md) | El flujo canónico: pasos, skills, gates, IDs, etiquetas por fase |
| [IMPLEMENTATION-RULE.md](IMPLEMENTATION-RULE.md) | Cómo se encarga e integra el código (R1-R4, techo de 2 ciclos) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Backbone del ATS: piezas, módulos y convenciones |
| [SETUP.md](SETUP.md) | Requisitos del portátil, Node 24 LTS y `npm run check:env` |
| [MVP-STATUS.md](MVP-STATUS.md) | Estado por módulo |
| [RGPD.md](RGPD.md) | Ejemplo didáctico de tratamiento de datos de candidatos (base de la feature A) |
| [_modules.md](_modules.md) | Mapa módulo docs ↔ código que usan skills y agentes |
| [_templates/](_templates/) | Las 15 plantillas de los artefactos del flujo (incluida `UC`, la del caso de uso) |

## Carpetas numeradas

| Carpeta | Qué contiene | La escribe |
|---|---|---|
| [00_methodology/](00_methodology/README.md) | El flujo en una página | a mano |
| [01_roadmap/sprints/](01_roadmap/sprints/) | `sprint-NN.md` | `/crear-sprint`, `/cerrar-sprint` |
| [02_discovery/ideas/](02_discovery/ideas/) | `NNN-slug.md` (+ `completadas/`, `descartadas/`) | `/anadir-idea` |
| [02_discovery/features/](02_discovery/features/) | `FEAT-NN-slug/feature.md` (+ `completadas/`, `descartadas/`) | `/feature-shaping` |
| [02_discovery/spikes/](02_discovery/spikes/) | `SPIKE-NN-slug.md` (+ `completadas/`, `descartadas/`) | a mano, con la plantilla `SPIKE` |
| [03_delivery/hu/](03_delivery/hu/) | `HU-NN-slug/` con `hu.md`, `specs/`, `plans/`, `tasks/`, `review/`, `CHANGELOG.md` (+ `completadas/`) | `product-owner` y las skills de delivery |
| [05_modules/](05_modules/) | `{candidatos,ofertas,inscripciones}/{functional,technical}.md` | `/module-sync` |
| `05_modules/{módulo}/casos-de-uso/` | Catálogo de casos de uso: `UC-NN-slug.md` + índice `README.md` | `/feature-shaping` los crea; `/module-sync` los mantiene |
| [06_design_principles/](06_design_principles/README.md) | Principios de interfaz del ATS | a mano |
| [07_architecture_principles/](07_architecture_principles/) | [QUALITY-GATES.md](07_architecture_principles/QUALITY-GATES.md), [DECISIONS.md](07_architecture_principles/DECISIONS.md) y `contracts/` | a mano y `/tech-design` |
| [10_audits/](10_audits/) | `reviews/`, `sprints/sprint-NN-AUDIT.md`, `qa/sprint-NN-AAAA-MM-DD/` | `/audit-sprint`, `/qa-e2e` |

## Por qué faltan 04, 08 y 09

La numeración se conserva del flujo del que nace este kit para que las rutas de skills y agentes no cambien. Los huecos
eran carpetas que un ATS de ejemplo no necesita:

- **04** — catálogo de productos: aquí hay un único producto.
- **08** — KPIs de negocio: el taller no mide negocio.
- **09** — cuadro de mando: `MVP-STATUS.md` basta para seguir el estado.

Si algún día hacen falta, se crean con ese número sin mover nada más.
