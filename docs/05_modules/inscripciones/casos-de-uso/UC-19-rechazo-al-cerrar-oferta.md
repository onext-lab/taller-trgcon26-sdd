---
id: UC-19
titulo: "Rechazar las inscripciones activas al cerrar una oferta"
modulo: inscripciones
actor: reclutador
estado: aprobado
feature: FEAT-03
hus: [HU-06]
---

# UC-19 — Rechazar las inscripciones activas al cerrar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
Al cerrarse una oferta, ningún candidato se queda en un proceso abierto: sus inscripciones activas se rechazan con el
motivo «oferta cerrada» y queda rastro de cada una.

## Actor y disparador
- **Actor principal:** reclutador, de forma indirecta: cierra la oferta y este caso se ejecuta dentro del cierre.
- **Disparador:** el caso de uso UC-04 (cerrar oferta, módulo `ofertas`) invoca la operación interna de
  `inscripciones` que rechaza las inscripciones activas de la oferta, dentro de la transacción de cierre (reparto
  entre módulos de reglas-validadas.md, S-10).

## Precondiciones
- La oferta está pasando de `published` a `closed` dentro de la transacción de UC-04 (RV-03, S-10).
- Antes de cerrar, UC-04 ha mostrado al reclutador cuántas inscripciones activas se rechazarán y este ha confirmado
  (S-10).

## Flujo principal (P)
1. `ofertas` invoca la operación interna con el ID de la oferta, dentro de su transacción de cierre.
2. `inscripciones` localiza las inscripciones de la oferta en etapa no final (`received`, `screening`, `interview` u
   `offer`) (RV-19).
3. Cada una pasa a `rejected` con un `StageChange` propio: origen, `rejected`, la fecha del cierre en UTC, motivo
   «oferta cerrada» y sin nota (RV-05, RV-21, S-15, S-16).
4. Para cada candidato al que no le queda ninguna inscripción no final, `candidatos` recalcula la retención desde ese
   día, en la misma transacción (S-06, RGPD §3).
5. La operación devuelve el número de inscripciones rechazadas y `ofertas` completa el cierre.

## Flujos alternativos
- **A1 — Sin inscripciones activas** (desde el paso 2): la oferta no tiene inscripciones, o todas están en `hired` o
  `rejected` → no se rechaza ni se recalcula nada; la operación devuelve 0 y el cierre sigue (RV-05).
- **A2 — Candidato con otras inscripciones abiertas** (desde el paso 4): el candidato sigue en algún proceso no final
  de otra oferta → su retención no cambia (S-06, RV-24).

## Excepciones
- **E1 — Falla una escritura** (en los pasos 3-4): la transacción de cierre se deshace entera: la oferta sigue
  `published`, ninguna inscripción cambia y ninguna retención se recalcula (S-10, S-06).
- **E2 — Cambio de etapa concurrente** (en el paso 2): si el reclutador avanza o rechaza una inscripción de la oferta
  mientras se cierra, la petición que llega después encuentra `rejected` y recibe 409 por RV-22, o 200 si pedía
  precisamente `rejected` (RV-23, S-01).

## Reglas de negocio
- RN-09: cerrar una oferta rechaza sus inscripciones no finales con el motivo «oferta cerrada», solo puesto por el
  sistema, en la misma transacción que el cierre.
- RN-10: cerrar la última inscripción no final de un candidato recalcula su retención en la misma transacción.
- INV-05: ninguna oferta `closed` tiene inscripciones no finales.

## Postcondiciones
- **Éxito:** la oferta está `closed` y ninguna de sus inscripciones está en etapa no final; cada inscripción rechazada
  tiene su `StageChange` con motivo «oferta cerrada»; las inscripciones en `hired` o `rejected` no cambian.
- **Fallo:** la oferta sigue `published` y nada de lo anterior ha cambiado.

## Datos personales
No escribe texto libre. Cierra procesos de candidatos, lo que recalcula su fecha de fin de retención (RGPD §3).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-06 | | |
| A1 | HU-06 | | |
| A2 | HU-06 | | |
| E1 | HU-06 | | |
| E2 | HU-06 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
