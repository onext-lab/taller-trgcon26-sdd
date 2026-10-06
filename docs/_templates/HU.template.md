---
id: HU-NN
feature: FEAT-NN
titulo: "<título corto>"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: []    # valores de docs/_modules.md
sprint: null             # sprint-NN
rama: "hu/HU-NN-slug"
---

# HU-NN — <título>

## Historia
Como **<rol>**, quiero **<capacidad>**, para **<beneficio>**.

## Contexto
<Qué parte de FEAT-NN cubre esta HU y por qué es atómica, vertical y con valor.>

## Casos de uso
Qué casos de uso del catálogo del módulo cubre esta HU y qué flujos (P principal, A alternativos, E excepciones).
Se citan por ID y ruta desde la raíz, sin enlace relativo (la HU se mueve a `completadas/` al cerrar el sprint).

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-NN | P, A1, E1 | `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` |

<Flujos de esos UC que NO cubre esta HU: cuáles y en qué HU van, o «fuera de alcance» con motivo.>

## Criterios de aceptación
- [ ] <verificable> _(UC-NN · P)_
- [ ] <verificable> _(UC-NN · E1)_

## Notas y dependencias
- **Depende de:** <HU-NN o nada>
- **Bloquea:** <HU-NN o nada>
- <notas>

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
