---
id: HU-08
feature: FEAT-04
titulo: "Anonimizar al vencer la retención"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [candidatos]
sprint: null             # sprint-NN
rama: "hu/HU-08-anonimizar-al-vencer"
---

# HU-08 — Anonimizar al vencer la retención

## Historia
Como **reclutador**, quiero **que los candidatos se anonimicen solos el día en que vence su plazo de retención**, para
**que ningún dato se conserve más allá de su plazo sin depender de que alguien se acuerde**.

## Contexto
Segunda rebanada de FEAT-04 (`docs/02_discovery/features/FEAT-04-supresion-y-retencion-candidatos/feature.md`,
«Handoff a delivery»). Reutiliza la anonimización de HU-07 con el motivo «vencimiento». El disparador (un proceso de
la propia API al arrancar y una vez al día) se ratificó el 2026-10-13 (FEAT-04, PA-02).

**Fuera de la variante mínima del taller:** queda en el backlog, sin sprint.

## Casos de uso

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-21 | P, A1, A2, A3, E1, E2 | `docs/05_modules/candidatos/casos-de-uso/UC-21-anonimizar-al-vencer-retencion.md` |

## Criterios de aceptación
- [ ] Con tres candidatos cuya fecha de fin fue ayer, es hoy y es mañana, la pasada anonimiza a los dos primeros con el
      motivo «vencimiento» y no al tercero. _(UC-21 · P)_
- [ ] Si falla la anonimización de un candidato, ese queda como estaba y los demás se anonimizan. _(UC-21 · E1)_
- [ ] Sin vencidos, la pasada no escribe nada; tras días con la API apagada, la siguiente pasada recoge a todos los
      vencidos. _(UC-21 · A1, A2)_

## Notas y dependencias
- **Depende de:** HU-07.
- **Bloquea:** nada.

## Progreso SDD
- [ ] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
