---
id: UC-20
titulo: "Anonimizar a un candidato a petición"
modulo: candidatos
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-07]
---

# UC-20 — Anonimizar a un candidato a petición

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador atiende la petición de supresión de un candidato (art. 17) anonimizando sus datos personales, sin borrar
filas ni romper las estadísticas de las ofertas (RGPD §4 y §5, RV-16).

## Actor y disparador
- **Actor principal:** reclutador (DEC-04). El candidato no usa la aplicación: el reclutador registra la petición
  declarando que el candidato la hizo (FEAT-04 Q02).
- **Disparador:** el reclutador pulsa «Anonimizar» en la ficha del candidato ([UC-12](UC-12-ver-ficha.md))
  (FEAT-04 Q06).

## Precondiciones
- El candidato existe.

## Flujo principal (P)
1. El reclutador pulsa «Anonimizar» en la ficha del candidato (FEAT-04 Q06).
2. El sistema muestra un diálogo de confirmación que avisa de que la anonimización es irreversible y, si las hay,
   cuántas inscripciones activas del candidato se rechazarán (FEAT-04 RN-09).
3. El reclutador confirma.
4. En una sola transacción (DEC-06), el sistema comprueba que el candidato existe y no está anonimizado (DEC-08) y:
   - sustituye el nombre por «Candidato anonimizado», el email por uno neutro y único, y deja vacíos el teléfono, el
     resumen y las skills (FEAT-04 RN-02 y RN-03, RGPD §5);
   - vacía la nota de todos los rechazos de su historial; las inscripciones, sus etapas y el resto del historial se
     conservan (FEAT-04 RN-04, RGPD §5);
   - conserva las fechas y la versión del consentimiento y la fecha de alta (FEAT-04 RN-05);
   - deja vacío el fin de retención, que ningún recálculo posterior cambia (FEAT-04 RN-07);
   - registra la fecha de la anonimización y el motivo «petición», sin guardar los datos borrados (FEAT-04 RN-06).
5. La web muestra la ficha del candidato anonimizado ([UC-12](UC-12-ver-ficha.md) · A2) con un mensaje de estado que
   confirma la anonimización (06_design_principles §2, FEAT-04 Q06).

## Flujos alternativos
- **A1 — Candidato ya anonimizado** (en el paso 4): → 200 sin cambios; no se toca ninguna fecha ni el motivo
  registrado (FEAT-04 RN-10, RGPD §5, S-01, DEC-08). Continúa en el paso 5.
- **A2 — Con inscripciones activas** (en el paso 4): el candidato tiene inscripciones en etapa no final → en la misma
  transacción, cada una pasa a `rejected` con el motivo «retirada del candidato», sin nota y con un `StageChange` propio
  con la fecha de la anonimización (FEAT-04 RN-08, RV-20, RV-21; ratificada el 2026-10-13, FEAT-04 PA-01). Continúa
  con el resto del paso 4.
- **A3 — Cancelar** (en el paso 3): el reclutador cancela el diálogo → no cambia nada y sigue en la ficha.

## Excepciones
- **E1 — Candidato inexistente** (en el paso 4): el ID no existe → 404 sin datos personales en el mensaje; no cambia
  nada (DEC-07).
- **E2 — Petición mal formada** (en el paso 4): el ID no es válido o llega un cuerpo con campos → 400 en el envelope;
  no cambia nada (S-03, DEC-11).
- **E3 — Falla una escritura** (en el paso 4): la transacción se deshace entera: ni datos sustituidos, ni notas
  vaciadas, ni inscripciones rechazadas, ni marca registrada; error en el envelope sin datos personales (DEC-06,
  RGPD §6.1).
- **E4 — API no disponible** (en el paso 2 o 4): la web muestra el estado de error con un mensaje útil; reintentar es
  seguro por A1 (06_design_principles §3 y §4).
- **E5 — Escritura concurrente sobre el mismo candidato** (en el paso 4): otra pestaña edita, cambia el consentimiento
  o inscribe al candidato a la vez → el estado se comprueba dentro de cada transacción; lo que llega después de la
  anonimización recibe 409 (FEAT-04 RN-11) y una inscripción creada antes queda rechazada por A2 (DEC-08).

## Reglas de negocio
- FEAT-04 RN-01 (suprimir es anonimizar), RN-02 y RN-03 (valores neutros y email), RN-04 (se conserva el historial sin
  notas), RN-05 (consentimiento y alta conservados), RN-06 (fecha y motivo), RN-07 (retención final), RN-08
  (inscripciones activas), RN-09 (confirmación), RN-10 (idempotencia), RN-20 (una transacción) y RN-21 (sin residuos).

## Postcondiciones
- **Éxito:** el candidato está anonimizado con fecha y motivo «petición»; no tiene nombre, email, teléfono, resumen ni
  skills reales; ninguna de sus inscripciones está en etapa no final ni tiene nota; sus inscripciones e historial
  siguen existiendo; el dato anterior no se puede recuperar de los ficheros de la base (FEAT-04 RN-21).
- **Fallo:** el candidato, sus inscripciones y su historial quedan como estaban.

## Datos personales
Sustituye nombre y apellidos, email, teléfono, resumen y skills, y vacía las notas de rechazo (RGPD §1 y §5). Es el
ejercicio del derecho de supresión (art. 17, RGPD §4). No guarda los datos borrados ni quién o por qué canal pidió la
supresión (RGPD §5, minimización §1).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-07 | CA-01, CA-02 | |
| A1 | HU-07 | CA-03 | |
| A2 | HU-07 | CA-04 | |
| A3 | HU-07 | CA-05 | |
| E1 | HU-07 | CA-06 | |
| E2 | HU-07 | CA-07 | |
| E3 | HU-07 | CA-08 | |
| E4 | HU-07 | CA-09 | |
| E5 | HU-07 | CA-10 | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
