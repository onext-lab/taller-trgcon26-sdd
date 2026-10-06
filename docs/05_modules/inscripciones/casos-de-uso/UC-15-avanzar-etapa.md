---
id: UC-15
titulo: "Avanzar una inscripción a la etapa siguiente"
modulo: inscripciones
actor: reclutador
estado: borrador
feature: FEAT-03
hus: []
---

# UC-15 — Avanzar una inscripción a la etapa siguiente

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador mueve una inscripción a la etapa siguiente del proceso, hasta `hired`, dejando rastro en su historial.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Avanzar» en la tarjeta de la inscripción en el pipeline de una oferta
  `published`.

## Precondiciones
- La inscripción existe y está en una etapa no final: `received`, `screening`, `interview` u `offer` (RV-19).

## Flujo principal (P)
1. El reclutador pide avanzar. La petición lleva la etapa destino y la etapa esperada, que es la que el reclutador
   está viendo (RV-22).
2. El sistema comprueba que la etapa actual coincide con la esperada (RV-22) y que el destino es la etapa
   inmediatamente siguiente: `received → screening → interview → offer → hired` (RV-19).
3. El sistema cambia la etapa y añade un `StageChange` con origen, destino y fecha en UTC, sin motivo ni nota
   (RV-21, RV-25, S-16).
4. El pipeline muestra la inscripción en su nueva columna.

## Flujos alternativos
- **A1 — Reintento de un cambio ya aplicado** (desde el paso 2): el destino es la etapa actual de la inscripción,
  aunque la etapa esperada ya no coincida → 200 sin cambios: no se crea `StageChange` ni se toca ninguna fecha. Termina
  (RV-23, S-01).
- **A2 — Contratación** (desde el paso 3): el destino es `hired` → la inscripción queda en etapa final. No cambia
  ninguna otra inscripción del candidato (RV-24) ni el estado de la oferta (RV-07), y se permite aunque otra
  inscripción de la misma oferta ya esté en `hired` (S-17). En la misma transacción, si era la última inscripción no
  final del candidato, `candidatos` recalcula su retención desde ese día, porque `hired` también cierra el proceso
  (S-06, RGPD §3). Vuelve al paso 4.

## Excepciones
- **E1 — Etapa esperada desactualizada** (en el paso 2): la etapa actual no coincide con la esperada y el destino no
  es la etapa actual → 409; la etapa y el historial no cambian (RV-22, S-02).
- **E2 — Transición no permitida** (en el paso 2): el destino salta etapas, retrocede o es `rejected` por esta vía → 409;
  no cambia nada (RV-19, S-02). El rechazo es [UC-16](UC-16-rechazar-inscripcion.md).
- **E3 — Inscripción en etapa final** (en el paso 2): la inscripción está en `hired` o `rejected` y el destino es otra
  etapa → 409; no cambia nada (RV-19, S-02).
- **E4 — Petición mal formada** (en el paso 1): etapa desconocida, falta la etapa esperada o llega un campo desconocido
  (por ejemplo, una nota) → 400 en el envelope de error; no cambia nada (RV-22, S-03, S-16).
- **E5 — Inscripción inexistente** (en el paso 2): → 404; no cambia nada.
- **E6 — Falla una escritura** (en el paso 3 o en A2): la transacción se deshace entera: ni cambio de etapa, ni
  `StageChange`, ni retención recalculada (S-06).

## Reglas de negocio
- RN-04: solo se avanza a la etapa siguiente; `hired` y `rejected` son finales.
- RN-06: el cambio de etapa envía la etapa esperada; si no coincide, 409 sin cambios.
- RN-07: pedir la etapa actual devuelve 200 sin `StageChange`; prevalece sobre RN-06.
- RN-08: contratar no toca otras inscripciones ni cierra la oferta; se admite más de un `hired` por oferta.
- RN-10: cerrar la última inscripción no final de un candidato recalcula su retención en la misma transacción.
- RN-11: las notas solo existen en los rechazos.

## Postcondiciones
- **Éxito:** la inscripción está en la etapa siguiente y su historial tiene un `StageChange` nuevo; en `hired`, la
  retención del candidato está recalculada si ya no le quedan inscripciones abiertas.
- **Fallo:** la etapa, el historial y la retención quedan igual que antes.

## Datos personales
Ninguno nuevo: el cambio de etapa no admite texto libre (S-16). Al cerrar el proceso con `hired`, se recalcula la fecha
de fin de retención del candidato (RGPD §3).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | | | |
| A1 | | | |
| A2 | | | |
| E1 | | | |
| E2 | | | |
| E3 | | | |
| E4 | | | |
| E5 | | | |
| E6 | | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
