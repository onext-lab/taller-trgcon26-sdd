---
id: UC-10
titulo: "Editar la ficha de un candidato"
modulo: candidatos
actor: reclutador
estado: implementado
feature: FEAT-04
hus: [HU-03, HU-07]
---

# UC-10 — Editar la ficha de un candidato

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador corrige o completa los datos de un candidato (derecho de rectificación, RGPD §4).

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Editar» en la ficha del candidato (UC-12).

## Precondiciones
- El candidato existe.

## Flujo principal (P)
1. El sistema muestra el formulario con los datos actuales.
2. El reclutador cambia nombre y apellidos, teléfono, resumen o skills, y guarda.
3. El sistema recorta, valida y normaliza con las mismas reglas que el alta (RV-09, S-03).
4. El sistema guarda los cambios sin recalcular la fecha de fin de retención (RGPD §3, S-06: solo se recalcula al
   cambiar el consentimiento o las inscripciones) y muestra la ficha actualizada.

## Flujos alternativos
- **A1 — Cambio de email** (desde el paso 2): el reclutador cambia el email por otro que no usa ningún candidato → se
  guarda normalizado (RV-10, RV-15). Continúa en el paso 4.
- **A2 — Mismo email con otra forma** (desde el paso 2): el email solo cambia en mayúsculas o espacios alrededor → se
  normaliza al mismo valor y no choca consigo mismo (RV-10). Continúa en el paso 4.
- **A3 — Sin cambios** (desde el paso 2): se guarda sin modificar nada → 200 sin cambios ni recálculo (S-01).

## Excepciones
- **E1 — Datos inválidos** (en el paso 3): campo fuera de límites o de formato, obligatorio vacío o campo desconocido
  o de solo lectura (fin de retención) → 400 con el error junto al campo; la ficha no cambia (RV-09, RV-12, S-03).
- **E2 — Email de otro candidato** (en el paso 3): el nuevo email ya lo usa otro candidato → 409 con el ID de ese
  candidato; la ficha no cambia (RV-10, RV-15).
- **E3 — Candidato inexistente** (en el paso 1 o 4): el ID no existe → 404 sin datos (QUALITY-GATES §3).
- **E4 — Fallo al guardar** (en el paso 4): la base de datos falla → error en el envelope sin datos personales; la
  ficha no cambia y el formulario conserva lo escrito (DEC-01).
- **E5 — Candidato anonimizado** (FEAT-04 · pendiente) (en el paso 1 o 4): el candidato está anonimizado → 409 y la ficha no cambia; la web
  no ofrece «Editar» en la ficha de un anonimizado (FEAT-04 RN-11, DEC-07).
- **E6 — Email del dominio reservado a los anonimizados** (FEAT-04 · pendiente) (en el paso 3): → 400 junto al campo; la ficha no cambia
  (FEAT-04 RN-03).

## Reglas de negocio
- RN-01 campos y límites; RN-02 normalización y esquema estricto; RN-03 email único y cambiable; RN-04 skills; RN-06
  retención solo del sistema; RN-10 edición sin recálculo; RN-11 última escritura gana.

## Postcondiciones
- **Éxito:** la ficha refleja los nuevos datos normalizados; la fecha de fin de retención y el consentimiento no
  cambian.
- **Fallo:** la ficha queda como estaba.

## Datos personales
Lee y escribe nombre y apellidos, email, teléfono, resumen y skills (RGPD §1). Base jurídica: la del candidato
(RGPD §2); es el ejercicio del derecho de rectificación (RGPD §4).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-03 | CA-07 | `apps/api/test/candidates/update.test.ts:41`, `e2e/candidates.spec.ts:185` |
| A1 | HU-03 | CA-08 | `apps/api/test/candidates/update.test.ts:65`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:96` |
| A2 | HU-03 | CA-09 | `apps/api/test/candidates/update.test.ts:74`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:113` |
| A3 | HU-03 | CA-10 | `apps/api/test/candidates/update.test.ts:83`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:142` |
| E1 | HU-03 | CA-11 | `apps/api/test/candidates/update.test.ts:144`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:152` |
| E2 | HU-03 | CA-12 | `apps/api/test/candidates/update.test.ts:161`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:175` |
| E3 | HU-03 | CA-13 | `apps/api/test/candidates/update.test.ts:176`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:226` |
| E4 | HU-03 | CA-14 | `apps/api/test/candidates/update-adversarial.test.ts:107`, `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx:244` |
| E5 | — (FEAT-04 · pendiente) | | pendiente |
| E6 | — (FEAT-04 · pendiente) | | pendiente |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
