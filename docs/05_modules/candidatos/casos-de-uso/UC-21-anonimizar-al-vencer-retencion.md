---
id: UC-21
titulo: "Anonimizar a los candidatos con la retención vencida"
modulo: candidatos
actor: proceso programado
estado: borrador
feature: FEAT-04
hus: []
---

# UC-21 — Anonimizar a los candidatos con la retención vencida

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
Ningún candidato conserva sus datos personales más allá de su fecha de fin de retención: al vencer, se anonimiza sin
que nadie tenga que acordarse (RGPD §3: «al vencer: anonimizar»).

## Actor y disparador
- **Actor principal:** proceso programado de la propia API (FEAT-04 RN-15; **pendiente de ratificar**, FEAT-04
  PA-02). El reclutador no interviene.
- **Disparador:** el arranque de la API y, mientras siga en marcha, una vez al día (FEAT-04 RN-15).

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. Se lanza la pasada.
2. El sistema toma el día de hoy en Europe/Madrid (DEC-09) y selecciona a los candidatos no anonimizados cuya fecha de
   fin de retención es igual o anterior a hoy: un candidato vence el mismo día de su fecha (FEAT-04 RN-14, RGPD §3,
   RV-25).
3. Por cada candidato, en su propia transacción (FEAT-04 RN-16), el sistema vuelve a comprobar que sigue vencido y sin
   anonimizar (DEC-08) y lo anonimiza igual que [UC-20](UC-20-anonimizar-a-peticion.md) en su paso 4, con el motivo
   «vencimiento»: valores neutros, notas vaciadas, consentimiento y alta conservados, fin de retención vacío y fecha y
   motivo registrados (FEAT-04 RN-02 a RN-07). No tiene inscripciones activas, porque con alguna no hay fecha de fin
   (S-06).
4. La pasada termina. No hay pantalla de resultado: cada ficha anonimizada muestra la fecha y el motivo
   ([UC-12](UC-12-ver-ficha.md) · A2) (FEAT-04 Q28).

## Flujos alternativos
- **A1 — Sin vencidos** (en el paso 2): ningún candidato cumple la condición → no se escribe nada.
- **A2 — La API estuvo apagada** (en el paso 2): han pasado varios días desde la última pasada → se seleccionan todos
  los candidatos con la fecha igual o anterior a hoy, sea cual sea el día en que vencieron (FEAT-04 Q26, RGPD §3).
- **A3 — Ya no está vencido o ya está anonimizado** (en el paso 3): entre la selección y la escritura el candidato ha
  registrado un consentimiento nuevo, lo han inscrito, lo han anonimizado a petición o lo ha anonimizado otra pasada →
  se salta sin escribir nada (DEC-08, FEAT-04 Q30).

## Excepciones
- **E1 — Falla la anonimización de un candidato** (en el paso 3): su transacción se deshace y queda como estaba; la
  pasada sigue con los demás y se reintenta en la siguiente; el log no lleva datos personales (FEAT-04 RN-16,
  RGPD §6.1).
- **E2 — Dato legacy con inscripción abierta** (en el paso 3): el candidato tiene la fecha vencida y alguna
  inscripción no final, un estado que la fórmula no produce (S-06) → se salta sin anonimizarlo y se registra en el log
  sin datos personales (FEAT-04 RN-17).

## Reglas de negocio
- FEAT-04 RN-02 a RN-07 (qué se sustituye y qué se conserva), RN-14 (vencimiento por día), RN-15 (cuándo se lanza),
  RN-16 (una transacción por candidato), RN-17 (legacy), RN-20 (comprobación en la transacción) y RN-21 (sin residuos).

## Postcondiciones
- **Éxito:** tras una pasada sin fallos, no queda ningún candidato sin anonimizar con la fecha de fin igual o anterior a
  hoy, salvo los legacy de E2 (FEAT-04 INV-07); los anonimizados llevan el motivo «vencimiento».
- **Fallo:** los candidatos cuya transacción falló quedan como estaban y se reintentan en la siguiente pasada.

## Datos personales
Sustituye nombre y apellidos, email, teléfono, resumen y skills, y vacía las notas de rechazo de los candidatos vencidos
(RGPD §3 y §5). Los logs de la pasada no llevan datos personales (RGPD §6.1).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | | | |
| A1 | | | |
| A2 | | | |
| A3 | | | |
| E1 | | | |
| E2 | | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
