---
id: UC-13
titulo: "Registrar, retirar o renovar el consentimiento para futuros procesos"
modulo: candidatos
actor: reclutador
estado: implementado
feature: FEAT-04
hus: [HU-03]
---

# UC-13 — Registrar, retirar o renovar el consentimiento para futuros procesos

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador deja constancia de que el candidato consiente (o deja de consentir) que se guarden sus datos para
futuros procesos, y el sistema ajusta su fecha de fin de retención.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador marca o desmarca la casilla de consentimiento en la ficha del candidato (UC-12).

## Precondiciones
- El candidato existe.

## Flujo principal (P) — Registrar
1. El candidato no tiene consentimiento vigente. El reclutador marca la casilla, junto a la que se muestra el texto
   y su versión, declarando que el candidato lo dio (RV-11, S-07).
2. El sistema guarda la fecha del consentimiento (la pone el sistema) y la versión del texto (constante versionada
   en el código) (RV-11, S-07).
3. El sistema recalcula la fecha de fin de retención con la fórmula (RN-07) en la misma transacción: la más tardía
   entre fecha del consentimiento + 24 meses y las demás que apliquen; sin fecha si tiene alguna inscripción no
   final (S-06, RGPD §3).
4. El sistema muestra la ficha con el consentimiento y la nueva fecha de fin.

## Flujos alternativos
- **A1 — Retirar** (desde el paso 1): el candidato tiene consentimiento vigente y el reclutador desmarca la casilla →
  el sistema guarda la fecha de retirada, conserva la de otorgamiento (S-07) y recalcula la retención sin el
  consentimiento: cierre del último proceso + 6 meses o, si nunca tuvo inscripciones, alta + 6 meses; sin fecha si
  tiene alguna inscripción no final. La fórmula se aplica aunque la fecha resultante ya haya pasado (RV-11, S-06,
  RGPD §3 y §4). Continúa en el paso 4.
- **A2 — Renovar** (desde el paso 1): el candidato ya tiene consentimiento vigente y el reclutador lo vuelve a
  registrar → fecha y versión nuevas y retención recalculada con 24 meses desde la nueva fecha (S-07, RGPD §3).
  Continúa en el paso 4.
- **A3 — Retirar sin consentimiento vigente** (desde el paso 1): se pide retirar un consentimiento que no existe o
  ya está retirado → 200 sin cambios; no se tocan fechas (S-01).
- **A4 — Candidato con la retención vencida** (FEAT-04 · pendiente) (desde el paso 1): el candidato aún no está anonimizado y su fecha de fin
  ya pasó → registrar un consentimiento nuevo sigue el flujo principal: es una base jurídica nueva (art. 6.1.a) y la
  retención recalculada deja de estar vencida (FEAT-04 RN-19, S-06, S-07, RGPD §2).

## Excepciones
- **E1 — Candidato inexistente** (en el paso 1): el ID no existe → 404 sin datos (QUALITY-GATES §3).
- **E2 — Fallo al guardar** (en el paso 2 o 3): la base de datos falla → error en el envelope; ni el consentimiento
  ni la retención cambian, porque van en la misma transacción (S-06, DEC-01).
- **E3 — Candidato anonimizado** (FEAT-04 · pendiente) (en el paso 1): el candidato está anonimizado → 409 al registrar, renovar o retirar,
  también cuando no hay consentimiento vigente (prevalece sobre A3); no cambia nada (FEAT-04 RN-11, DEC-07).

## Reglas de negocio
- RN-05 consentimiento; RN-06 retención solo del sistema; RN-07 fórmula de retención; RN-12 puerto de procesos.

## Postcondiciones
- **Éxito:** el consentimiento queda registrado, retirado o renovado con sus fechas y versión, y la fecha de fin de
  retención es la que da la fórmula.
- **Fallo:** el consentimiento y la fecha de fin de retención quedan como estaban.

## Datos personales
Escribe el consentimiento (fecha de otorgamiento, versión del texto y, en su caso, fecha de retirada) y la fecha de fin
de retención. Base jurídica de la conservación para futuros procesos: consentimiento, art. 6.1.a (RGPD §2); la
retirada es el ejercicio del art. 7.3 (RGPD §4).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-03 | CA-25, CA-31 | `apps/api/test/candidates/consent.test.ts:49`, `apps/api/test/candidates/retention.test.ts:92`, `e2e/candidates.spec.ts:253` |
| A1 | HU-03 | CA-26, CA-31 | `apps/api/test/candidates/consent.test.ts:125`, `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx:176` |
| A2 | HU-03 | CA-27 | `apps/api/test/candidates/consent.test.ts:65`, `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx:219` |
| A3 | HU-03 | CA-28 | `apps/api/test/candidates/consent.test.ts:144` |
| A4 | — (FEAT-04 · pendiente) | | pendiente |
| E1 | HU-03 | CA-29 | `apps/api/test/candidates/consent-adversarial.test.ts:135` |
| E2 | HU-03 | CA-30 | `apps/api/test/candidates/consent-adversarial.test.ts:149`, `apps/web/test/features/candidates/CandidateDetailScreen.adversarial.test.tsx:162` |
| E3 | — (FEAT-04 · pendiente) | | pendiente |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
