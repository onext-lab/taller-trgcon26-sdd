---
id: UC-18
titulo: "Consultar el historial de una inscripción"
modulo: inscripciones
actor: reclutador
estado: implementado
feature: FEAT-03
hus: [HU-05]
---

# UC-18 — Consultar el historial de una inscripción

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador ve cada decisión tomada sobre una inscripción: qué etapa, cuándo y, si fue un rechazo, por qué.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre una inscripción desde el pipeline ([UC-17](UC-17-ver-pipeline.md)).

## Precondiciones
- La inscripción existe.

## Flujo principal (P)
1. El reclutador abre el detalle de la inscripción.
2. El sistema muestra la etapa actual y la lista de `StageChange` en orden cronológico, el más antiguo primero: etapa
   origen, etapa destino y fecha en `dd/mm/aaaa`, hora de Europe/Madrid (RV-21, RV-25).
3. En el `StageChange` de rechazo se muestran también el motivo y la nota, si la hay (RV-20, RV-21).

## Flujos alternativos
- **A1 — Inscripción recién creada** (desde el paso 2): solo hay un `StageChange`, sin origen → `received`, que
  muestra la fecha de inscripción (S-13).
- **A2 — Rechazo por cierre de oferta** (desde el paso 3): el motivo es «oferta cerrada» y no hay nota
  ([UC-19](UC-19-rechazo-al-cerrar-oferta.md), RV-05).

## Excepciones
- **E1 — Inscripción inexistente** (en el paso 1): → 404; la web muestra el estado de error.
- **E2 — API no disponible** (en el paso 2): la web muestra el estado de error con un mensaje útil (principio de
  diseño 3).

## Reglas de negocio
- RN-03: toda inscripción tiene su `StageChange` inicial.
- RN-13: las fechas se guardan en UTC y se muestran en Europe/Madrid.
- INV-03: el historial no se modifica ni se borra, solo crece.

## Postcondiciones
- **Éxito:** el reclutador ve el historial completo. Es un caso de solo lectura.
- **Fallo:** no cambia nada.

## Datos personales
Lee la nota de rechazo, que puede contener datos personales (RV-20): solo se muestra en este detalle, nunca en el
pipeline ni en listados (RGPD §6.2).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-05 | CA-24 | `apps/api/test/applications/detail.test.ts:67`, `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx:45` |
| A1 | HU-05 | CA-25 | `apps/api/test/applications/detail.test.ts:103`, `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx:78` |
| A2 | HU-05 | CA-26 | `apps/api/test/applications/detail.test.ts:114`, `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx:90` |
| E1 | HU-05 | CA-27 | `apps/api/test/applications/detail.test.ts:192`, `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx:123` |
| E2 | HU-05 | CA-28 | `apps/web/test/features/applications/ApplicationDetailScreen.test.tsx:139` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
