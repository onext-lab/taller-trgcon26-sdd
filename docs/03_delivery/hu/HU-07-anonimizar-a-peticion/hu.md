---
id: HU-07
feature: FEAT-04
titulo: "Anonimizar a petición"
estado: en curso         # pendiente | en curso | bloqueada | hecha | descartada
rol: "reclutador"
modulos_afectados: [candidatos, inscripciones]
sprint: sprint-03        # sprint-NN
rama: "hu/HU-07-anonimizar-a-peticion"
---

# HU-07 — Anonimizar a petición

## Historia
Como **reclutador**, quiero **anonimizar a un candidato cuando me pide la supresión de sus datos**, para **atender su
derecho de supresión sin borrar nada a mano y sin que el resto de la aplicación falle ni muestre sus datos**.

## Contexto
Primera rebanada de FEAT-04 (`docs/02_discovery/features/FEAT-04-supresion-y-retencion-candidatos/feature.md`,
«Handoff a delivery»). Es vertical a propósito: en cuanto existe un candidato anonimizado, el detalle de una
inscripción daría 500 (`docs/RGPD.md` §7.5) y los puertos de `inscripciones` tienen que reconocer la marca; partirla
dejaría ese 500 alcanzable entre las dos mitades. Incluye la anonimización (UC-20), las guardas del resto de la
aplicación sobre un anonimizado y el candidato anonimizado del seed.

**Variante mínima del taller** (decisión de la persona responsable del 2026-10-09): la solución de referencia de la
feature en vivo A llega hasta el PRD de esta HU, sin implementar.

Cuatro respuestas de producto (FEAT-04, PA-01 a PA-04) se ratificaron el 2026-10-13 tal como las recomendaba el
shaping; el PRD las recoge como DT-01 a DT-04. Para esta HU importan PA-01 (anonimizar con inscripciones abiertas, rechazándolas) y PA-04 (se
conservan las fechas del consentimiento y del alta).

## Casos de uso

| UC | Flujos cubiertos | Fichero |
|---|---|---|
| UC-20 | P, A1, A2, A3, E1, E2, E3, E4, E5 | `docs/05_modules/candidatos/casos-de-uso/UC-20-anonimizar-a-peticion.md` |
| UC-09 | E4 | `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md` |
| UC-10 | E5, E6 | `docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md` |
| UC-11 | A5 | `docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md` |
| UC-12 | A2, A4 | `docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` |
| UC-13 | E3 | `docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md` |
| UC-14 | E6 | `docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` |
| UC-15 | E7 | `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md` |
| UC-16 | A2 | `docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md` |
| UC-17 | A3 | `docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` |
| UC-18 | A3 | `docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` |
| UC-19 | A3 | `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` |

No cubre: UC-21 (HU-08), UC-12 · A3, UC-13 · A4 y UC-14 · E7 (HU-09).

## Criterios de aceptación
- [ ] Un candidato con dos inscripciones activas, anonimizado a petición tras confirmar, muestra «Candidato
      anonimizado» con fecha y motivo «petición», y sus dos inscripciones quedan en «Rechazado» con el motivo «retirada
      del candidato». _(UC-20 · P, A2)_
- [ ] Anonimizar otra vez a un anonimizado responde 200 y no cambia nada. _(UC-20 · A1)_
- [ ] El historial de un anonimizado conserva etapas y motivos y no tiene ninguna nota. _(UC-16 · A2; FEAT-04 RN-04)_
- [ ] Un anonimizado no aparece en el listado ni en la búsqueda por su antiguo nombre o email. _(UC-11 · A5)_
- [ ] Editar, cambiar el consentimiento o inscribir a un anonimizado responde 409 y no cambia nada. _(UC-10 · E5,
      UC-13 · E3, UC-14 · E6)_
- [ ] El alta y la edición rechazan con 400 un email del dominio reservado a los anonimizados. _(UC-09 · E4, UC-10 ·
      E6)_
- [ ] El pipeline y el detalle de una inscripción de un anonimizado muestran «Candidato anonimizado» y el historial
      sin notas, nunca un error. _(UC-17 · A3, UC-18 · A3)_
- [ ] Ni el fichero de la base ni su `-wal` contienen el nombre, el email ni el teléfono anteriores de un anonimizado.
      _(FEAT-04 RN-21)_

## Notas y dependencias
- **Depende de:** nada.
- **Bloquea:** HU-08 y HU-09.
- Datos personales: la revisa el agente `datos-personales-auditor` en `/reviewer`.

## Progreso SDD
- [x] PRD (`specs/PRD.md`) — `/prd-writer`
- [ ] Diseño técnico (`plans/TECHNICAL_DOC.md`) — `/tech-design`
- [ ] Tareas (`tasks/ROADMAP.md`) — `/task-planner`
- [ ] Implementación + integración — `/implementar-hu`
- [ ] Review (`review/REVIEW.md`) — `/reviewer`
- [ ] Sync de módulos + merge local a `main` — `/module-sync`
