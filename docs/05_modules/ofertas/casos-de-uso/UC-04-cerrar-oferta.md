---
id: UC-04
titulo: "Cerrar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-02, HU-05]
---

# UC-04 — Cerrar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador da por terminado el proceso de una oferta publicada; la oferta pasa a ser de solo lectura y final.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Cerrar» en la ficha de una oferta publicada (UC-08).

## Precondiciones
- La oferta existe y está en `published`.

## Flujo principal (P)
1. El reclutador pulsa «Cerrar».
2. El sistema muestra un diálogo de confirmación con el número de inscripciones activas (en etapa no final) que se
   rechazarán (S-10).
3. El reclutador confirma.
4. En una sola transacción, el sistema pasa la oferta a `closed`, guarda la fecha de cierre en UTC y pide a
   `inscripciones` que rechace las inscripciones activas de la oferta (RN-08).
5. El sistema muestra la oferta en solo lectura, con su fecha de cierre en Europe/Madrid (RV-04, S-10).

## Flujos alternativos
- **A1 — Hay inscripciones activas** (desde el paso 4): cada inscripción de la oferta en etapa no final pasa a
  `rejected` con el motivo «oferta cerrada» y su `StageChange`; las que están en `hired` o `rejected` no cambian
  (RV-05, RV-19, RV-21, S-15). Lo ejecuta UC-19 (`docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md`),
  una operación interna de `inscripciones` que `ofertas` invoca dentro de la transacción del paso 4; ese rechazo
  recalcula también el fin de retención de los candidatos afectados en la misma transacción (S-06). Vuelve al paso 5.
- **A2 — Cancelar el cierre** (desde el paso 3): el reclutador cancela el diálogo → no cambia nada y sigue en la ficha
  (S-10).
- **A3 — Ya cerrada** (desde el paso 1): la oferta ya está en `closed` → 200 sin cambios; la fecha de cierre no se
  toca y no se crea ningún `StageChange` (S-01).

## Excepciones
- **E1 — Oferta en borrador** (en el paso 1): la oferta está en `draft` → 409; no cambia nada. Un borrador no se
  cierra: se borra (UC-05) (RV-03, RV-06, S-10).
- **E2 — Fallo durante el cierre** (en el paso 4): falla cualquier escritura de la transacción → error con el envelope
  de DEC-01; ni se cierra la oferta ni se rechaza ninguna inscripción (S-10).

## Reglas de negocio
- RN-06: transiciones `draft → published → closed`; `closed` es final; una transición no permitida da 409.
- RN-07: repetir una transición ya aplicada devuelve 200 sin cambios.
- RN-08: el cierre es una sola transacción: estado `closed`, fecha de cierre y rechazo de las inscripciones activas.
- RN-13: contratar no cierra la oferta; la cierra el reclutador.

## Postcondiciones
- **Éxito:** la oferta está en `closed` con su fecha de cierre, ninguna inscripción suya queda en etapa no final y no
  admite inscripciones nuevas (RV-17).
- **Fallo:** la oferta sigue en `published` y sus inscripciones quedan como estaban.

## Datos personales
La oferta no contiene datos personales. A través de UC-19, el cierre escribe en las inscripciones y su historial de
etapas (datos del proceso de selección, base 6.1.b; `docs/RGPD.md` §1-2) y desencadena el recálculo del fin de
retención de los candidatos afectados (`docs/RGPD.md` §3, S-06).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-02 | CA-05 | `apps/api/test/jobs/close.test.ts:51` |
| A1 | HU-05 | | |
| A2 | HU-02 | CA-06 | `apps/web/test/features/jobs/CloseJobAction.test.tsx:121` |
| A3 | HU-02 | CA-07 | `apps/api/test/jobs/close.test.ts:80` |
| E1 | HU-02 | CA-08 | `apps/api/test/jobs/close.test.ts:143` |
| E2 | HU-02 | CA-09 | `apps/api/test/jobs/close.test.ts:161` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
