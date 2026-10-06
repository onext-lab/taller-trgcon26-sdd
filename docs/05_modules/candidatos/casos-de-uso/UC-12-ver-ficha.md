---
id: UC-12
titulo: "Ver la ficha de un candidato"
modulo: candidatos
actor: reclutador
estado: aprobado
feature: FEAT-02
hus: [HU-03, HU-04]
---

# UC-12 — Ver la ficha de un candidato

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador consulta todos los datos de un candidato, su consentimiento y cuándo vence su retención.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre un candidato desde el listado (UC-11) o llega tras el alta (UC-09) o la
  edición (UC-10).

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador abre la ficha de un candidato.
2. El sistema muestra nombre y apellidos, email, teléfono, resumen y skills (06_design_principles §5).
3. El sistema muestra el consentimiento: si está vigente, su fecha y versión del texto; si se retiró, la fecha de
   otorgamiento y la de retirada; si nunca se dio, que no hay (RV-11, S-07).
4. El sistema muestra la fecha de fin de retención en solo lectura, en `dd/mm/aaaa` en Europe/Madrid (RV-12, RV-25,
   06_design_principles §6).

## Flujos alternativos
- **A1 — Proceso en curso** (en el paso 4): el candidato tiene alguna inscripción no final y su fin de retención está
  vacío → se muestra «Mientras dure el proceso» (S-06, RGPD §3).

## Excepciones
- **E1 — Candidato inexistente** (en el paso 1): el ID no existe → 404 sin datos y mensaje «Candidato no encontrado»
  (QUALITY-GATES §3).
- **E2 — API no disponible** (en el paso 1): la web no recibe respuesta → estado de error con opción de reintentar
  (06_design_principles §3).

## Reglas de negocio
- RN-05 consentimiento; RN-06 retención solo del sistema; RN-07 fórmula de retención; RN-09 fechas.

## Postcondiciones
- **Éxito:** el reclutador ve la ficha completa.
- **Fallo:** no cambia nada en el sistema (operación de solo lectura).

## Datos personales
Lee todos los datos del candidato (RGPD §1). La ficha completa solo se muestra en el detalle, nunca en el listado
(RGPD §6, 06_design_principles §5).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-03 | CA-22 | `apps/api/test/candidates/get.test.ts:41`, `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:101`, `e2e/candidates.spec.ts:213` |
| A1 | HU-04 | | |
| E1 | HU-03 | CA-23 | `apps/api/test/candidates/get.test.ts:140`, `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:195` |
| E2 | HU-03 | CA-24 | `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx:232` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
