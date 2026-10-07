---
id: UC-17
titulo: "Ver el pipeline de una oferta"
modulo: inscripciones
actor: reclutador
estado: aprobado
feature: FEAT-03
hus: [HU-04, HU-05]
---

# UC-17 — Ver el pipeline de una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador ve de un vistazo en qué etapa está cada candidato inscrito en una oferta y actúa sobre ellos.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre el pipeline de una oferta.

## Precondiciones
- La oferta existe y está `published` o `closed` (S-18). Un borrador no puede tener inscripciones (RV-17).

## Flujo principal (P)
1. El reclutador abre el pipeline de una oferta `published`.
2. El sistema muestra una columna por etapa: recibida, cribado, entrevista, oferta, contratado y rechazado (RV-19,
   S-18).
3. Cada inscripción aparece como una tarjeta con solo el nombre del candidato y la fecha del último cambio de etapa en
   formato `dd/mm/aaaa`, hora de Europe/Madrid; en la columna «rechazado», también el motivo (S-18, RV-25, RGPD §6.2).
4. Cada columna se ordena por la fecha del último cambio, la más reciente primero, sin paginación (S-18).
5. Las tarjetas en etapa no final ofrecen «Avanzar» ([UC-15](UC-15-avanzar-etapa.md)) y «Rechazar»
   ([UC-16](UC-16-rechazar-inscripcion.md)); toda tarjeta abre su historial ([UC-18](UC-18-consultar-historial.md)).
   El pipeline ofrece «Inscribir candidato» ([UC-14](UC-14-inscribir-candidato.md)) (S-19).

## Flujos alternativos
- **A1 — Oferta cerrada** (desde el paso 1): la oferta está `closed` → se muestra el mismo pipeline en solo lectura,
  sin «Avanzar», «Rechazar» ni «Inscribir candidato»; el historial sí se puede consultar (S-18, RV-04).
- **A2 — Sin inscripciones** (desde el paso 2): la oferta no tiene inscripciones → estado vacío con un mensaje que lo
  explica y, si está `published`, la acción «Inscribir candidato» (principio de diseño 3).
- **A3 — Candidato anonimizado** (desde el paso 3): la tarjeta muestra «Candidato anonimizado» en lugar del nombre
  (RGPD §5, S-05).

## Excepciones
- **E1 — Oferta inexistente** (en el paso 1): → 404; la web muestra el estado de error.
- **E2 — API no disponible** (en el paso 2): la web muestra el estado de error con un mensaje útil, sin *stack trace*
  (principios de diseño 3 y 4).

## Reglas de negocio
- RN-12: el pipeline muestra solo el nombre del candidato; se ve también en ofertas cerradas, en solo lectura.
- RN-13: las fechas se guardan en UTC y se muestran en Europe/Madrid.

## Postcondiciones
- **Éxito:** el reclutador ve todas las inscripciones de la oferta agrupadas por etapa. Es un caso de solo lectura.
- **Fallo:** no cambia nada.

## Datos personales
Lee el nombre del candidato y nada más: ni email ni teléfono ni nota (minimización, RGPD §6.2). El motivo de rechazo es
un valor de lista cerrada, no texto libre.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-04, HU-05 | CA-12, CA-13 (HU-04); CA-22 (HU-05) | `apps/api/test/applications/pipeline.test.ts:60`, `apps/web/test/features/applications/PipelineScreen.test.tsx:40`; CA-22: `apps/web/test/features/applications/PipelineScreen.links.test.tsx:60`, `apps/web/test/features/applications/PipelineScreen.advance.test.tsx:64` |
| A1 | HU-05 | CA-23 | `apps/web/test/features/applications/PipelineScreen.links.test.tsx:99`, `e2e/pipeline-closed.spec.ts:31` |
| A2 | HU-04 | CA-14 | `apps/api/test/applications/pipeline.test.ts:137`, `apps/web/test/features/applications/PipelineScreen.states.test.tsx:41` |
| A3 | — (feature A) | | |
| E1 | HU-04 | CA-15 | `apps/api/test/applications/pipeline.test.ts:146`, `apps/web/test/features/applications/PipelineScreen.states.test.tsx:87` |
| E2 | HU-04 | CA-16 | `apps/web/test/features/applications/PipelineScreen.states.test.tsx:105` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
