---
id: HU-09
feature: FEAT-04
titulo: "Retención vencida pendiente de anonimizar"
estado: pendiente        # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [candidatos, inscripciones]
sprint: null             # sprint-NN
rama: "hu/HU-09-retencion-vencida-pendiente"
---

# HU-09 — Retención vencida pendiente de anonimizar

## Historia
Como **reclutador**, quiero **ver que un candidato tiene la retención vencida y no poder inscribirlo hasta que se
anonimice o dé un consentimiento nuevo**, para **no alargar la conservación de sus datos sin una base jurídica nueva**.

## Contexto
Tercera rebanada de FEAT-04 (`docs/02_discovery/features/FEAT-04-supresion-y-retencion-candidatos/feature.md`,
«Handoff a delivery»). El bloqueo de la inscripción de un vencido está **pendiente de ratificar** (FEAT-04, PA-03). Se
puede fusionar con HU-08 si la ventana entre el vencimiento y la pasada se considera despreciable.

**Fuera de la variante mínima del taller:** queda en el backlog, sin sprint.

## Casos de uso

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-12 | A3 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` |
| UC-13 | A4 | `docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md` |
| UC-14 | E7 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` |

## Criterios de aceptación
- [ ] La ficha de un candidato con la retención vencida y sin anonimizar muestra «Vencida el dd/mm/aaaa · pendiente de
      anonimizar». _(UC-12 · A3)_
- [ ] Inscribir a un candidato vencido responde 409. _(UC-14 · E7)_
- [ ] Registrar un consentimiento nuevo a un vencido recalcula su retención y deja de estar vencido. _(UC-13 · A4)_

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
