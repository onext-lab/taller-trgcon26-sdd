---
id: UC-16
titulo: "Rechazar una inscripción"
modulo: inscripciones
actor: reclutador
estado: implementado
feature: FEAT-04
hus: [HU-05]
---

# UC-16 — Rechazar una inscripción

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador saca a un candidato del proceso de una oferta, dejando constancia del motivo.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Rechazar» en la tarjeta de la inscripción en el pipeline de una oferta
  `published`.

## Precondiciones
- La inscripción existe y está en una etapa no final (RV-19).

## Flujo principal (P)
1. El sistema muestra el formulario de rechazo: un motivo obligatorio entre «no encaja con el perfil», «retirada del
   candidato» y «otro», y una nota opcional de hasta 500 caracteres con el aviso de no usarla para datos sensibles
   (RV-20, S-15).
2. El reclutador elige el motivo, escribe la nota si quiere y confirma. La petición lleva la etapa esperada (RV-22).
3. El sistema recorta los espacios de la nota (solo espacios = sin nota) y valida el motivo, la longitud de la nota y
   que la etapa actual coincide con la esperada (RV-20, RV-22, S-03).
4. El sistema pasa la inscripción a `rejected` y añade un `StageChange` con origen, destino, fecha en UTC, motivo y
   nota (RV-21, RV-25).
5. En la misma transacción, si era la última inscripción no final del candidato, `candidatos` recalcula su retención
   desde ese día (S-06, RGPD §3).
6. El pipeline muestra la inscripción en la columna «rechazada» con su motivo (S-18).

## Flujos alternativos
- **A1 — Reintento de un rechazo ya aplicado** (desde el paso 3): la inscripción ya está en `rejected` → 200 sin
  cambios: no se crea `StageChange` y no cambian ni el motivo ni la nota originales. Termina (RV-23, S-01, RV-21).
- **A2 — Inscripción de un candidato anonimizado** (FEAT-04 · pendiente) (desde el paso 3): al anonimizar, sus inscripciones activas pasaron
  a `rejected` (FEAT-04 RN-08) → si está en `rejected`, se aplica A1 (200 sin cambios); si está en `hired`, E4 (409).
  La retención del candidato nunca se recalcula (FEAT-04 RN-07, RGPD §5).

## Excepciones
- **E1 — Motivo ausente o no permitido** (en el paso 3): falta el motivo, no está en la lista o es «oferta cerrada»,
  que reserva el sistema para [UC-19](UC-19-rechazo-al-cerrar-oferta.md) → 400; no cambia nada (RV-20, S-15).
- **E2 — Nota demasiado larga** (en el paso 3): más de 500 caracteres tras recortar → 400; no cambia nada (RV-20, S-03).
- **E3 — Etapa esperada desactualizada** (en el paso 3): la etapa actual no coincide con la esperada y no es
  `rejected` → 409; no cambia nada (RV-22, S-02).
- **E4 — Inscripción contratada** (en el paso 3): la inscripción está en `hired` → 409; no cambia nada (RV-19, S-02).
- **E5 — Inscripción inexistente** (en el paso 3): → 404; no cambia nada.
- **E6 — Falla una escritura** (en los pasos 4-5): la transacción se deshace entera: ni rechazo, ni `StageChange`, ni
  retención recalculada (S-06).

## Reglas de negocio
- RN-04: `rejected` es posible desde cualquier etapa no final y es final.
- RN-05: el rechazo exige un motivo de la lista; la nota es opcional y de 500 caracteres como máximo.
- RN-06: el cambio de etapa envía la etapa esperada; si no coincide, 409 sin cambios.
- RN-07: pedir la etapa actual devuelve 200 sin `StageChange`; prevalece sobre RN-06.
- RN-09: el motivo «oferta cerrada» solo lo pone el sistema al cerrar la oferta.
- RN-10: cerrar la última inscripción no final de un candidato recalcula su retención en la misma transacción.

## Postcondiciones
- **Éxito:** la inscripción está en `rejected` con un `StageChange` que guarda motivo y nota; la retención del candidato
  está recalculada si ya no le quedan inscripciones abiertas.
- **Fallo:** la etapa, el historial y la retención quedan igual que antes.

## Datos personales
La nota es texto libre y puede acabar identificando a la persona: por eso es opcional, limitada a 500 caracteres y con
aviso en la interfaz (RV-20). Nunca se escribe en logs ni en mensajes de error (RGPD §6.1). Al anonimizar, a petición
o por vencimiento, se vacía como el resto de texto libre (RGPD §5, FEAT-04 RN-04). El cierre del proceso recalcula la
fecha de fin de retención (RGPD §3).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-05 | CA-12, CA-13, CA-21 | `apps/api/test/applications/reject.test.ts:95`, `apps/web/test/features/applications/PipelineScreen.reject.test.tsx:60`, `apps/api/test/applications/stage-change-privacy.test.ts:83` |
| A1 | HU-05 | CA-14 | `apps/api/test/applications/reject.test.ts:124` |
| A2 | — (FEAT-04 · pendiente) | | pendiente |
| E1 | HU-05 | CA-15 | `apps/api/test/applications/reject.test.ts:195` |
| E2 | HU-05 | CA-16, CA-21 | `apps/api/test/applications/reject-note.test.ts:57`, `apps/api/test/applications/stage-change-privacy.test.ts:83` |
| E3 | HU-05 | CA-17 | `apps/api/test/applications/reject.test.ts:207` |
| E4 | HU-05 | CA-18 | `apps/api/test/applications/reject.test.ts:224` |
| E5 | HU-05 | CA-19 | `apps/api/test/applications/reject.test.ts:239` |
| E6 | HU-05 | CA-20 | `apps/api/test/applications/stage-change-failures-adversarial.test.ts:131` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
