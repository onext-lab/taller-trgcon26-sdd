---
id: UC-02
titulo: "Editar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-01, HU-02]
---

# UC-02 — Editar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

**Origen:** FEAT-01. **Modificado por:** FEAT-04 (fecha límite de inscripción); lo marcado «(FEAT-04)» está pendiente
de su HU.

## Objetivo
El reclutador corrige o completa los datos de una oferta en `draft` o `published`.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador elige «Editar» en la ficha de una oferta (UC-08).

## Precondiciones
- La oferta existe y está en `draft` o `published` (RV-04).

## Flujo principal (P)
1. El reclutador abre la oferta en modo edición.
2. El reclutador modifica campos y guarda; (FEAT-04) entre ellos, puede fijar, ampliar, reducir o quitar (dejar
   vacía) la fecha límite de inscripción (FEAT-04 · RN-07).
3. El sistema recorta los espacios y valida los campos con las mismas reglas que al crear (RN-03, RN-04); (FEAT-04) la
   fecha límite, solo si cambia, con las de UC-01 · E7 (FEAT-04 · RN-05, RN-06).
4. El sistema guarda los cambios sin alterar el estado ni las fechas de la oferta.
5. El sistema muestra la ficha actualizada.

## Flujos alternativos
- **A1 — Edición concurrente** (desde el paso 4): otra pestaña guardó la misma oferta entre medias → se guarda esta
  edición y gana la última escritura; termina en el paso 5 (S-02).
- **A2 — Reabrir un plazo vencido** (desde el paso 2) (FEAT-04): la oferta tiene el plazo vencido y el reclutador
  amplía la fecha límite a hoy o después, o la quita → se guarda y la oferta vuelve a admitir inscripciones si está
  `published`; termina en el paso 5 (FEAT-04 · RN-07; R3).
- **A3 — Editar otros campos con el plazo vencido** (desde el paso 3) (FEAT-04): la oferta tiene el plazo vencido y la
  edición no cambia la fecha límite → la fecha no se comprueba y la edición se guarda; el plazo sigue vencido; termina
  en el paso 5 (FEAT-04 · RN-05; P8).

## Excepciones
- **E1 — Oferta cerrada** (en el paso 1): la oferta está en `closed` → la ficha es de solo lectura y no ofrece
  «Editar»; si la petición llega a la API, la rechaza con 409 y no cambia nada (RV-04, S-02). (FEAT-04) Tampoco se
  cambia su fecha límite (FEAT-04 · RN-07).
- **E2 — Campo inválido** (en el paso 3): incumple alguna validación de UC-01 (E1-E6) → 400 junto al campo; la oferta
  queda como estaba (RV-01, S-03, S-08).
- **E3 — Vaciar un obligatorio de una publicada** (en el paso 3): la oferta está en `published` y la edición deja sin
  valor el título, la descripción, la ubicación o la modalidad → 400 junto al campo; la oferta queda como estaba
  (S-09). La fecha límite no es obligatoria: quitarla está permitido (FEAT-04 · RN-01).
- **E4 — Cerrada mientras se editaba** (en el paso 4): la oferta pasó a `closed` después de abrirse el formulario → 409
  como en E1; no cambia nada (RV-04, S-02).
- **E5 — Fecha límite inválida o pasada** (en el paso 3) (FEAT-04): la edición cambia la fecha límite a un valor que no
  es un día `AAAA-MM-DD` existente o que es anterior a hoy en Europe/Madrid → 400 junto al campo; la oferta queda como
  estaba. La de hoy sí vale (FEAT-04 · RN-05, RN-06; R2, R3).

## Reglas de negocio
- RN-03: formatos y recorte de los campos.
- RN-04: banda salarial opcional, con extremos independientes.
- RN-05: solo se editan las ofertas `draft` y `published`; una publicada mantiene los obligatorios; gana la última
  escritura.
- FEAT-04 · RN-01: la fecha límite es opcional; vacía = sin plazo.
- FEAT-04 · RN-05: al cambiar la fecha límite, no puede ser anterior a hoy; si no cambia, no se comprueba.
- FEAT-04 · RN-06: la fecha límite es un día `AAAA-MM-DD` existente, sin fecha máxima.
- FEAT-04 · RN-07: se fija, amplía, reduce o quita en `draft` y `published`; en `closed`, no; ampliar o quitar un
  plazo vencido reabre las inscripciones.

## Postcondiciones
- **Éxito:** la oferta tiene los valores nuevos, con el mismo estado y las mismas fechas de creación, publicación y
  cierre.
- **Fallo:** la oferta queda exactamente como estaba.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-09, CA-10 | `apps/api/test/jobs/update.test.ts:40` |
| A1 | HU-01 | CA-11 | `apps/api/test/jobs/update.test.ts:85` |
| E1 | HU-02 | CA-10 | `apps/api/test/jobs/status-rules.test.ts:64` |
| E2 | HU-01 | CA-12 | `apps/api/test/jobs/update.test.ts:144` |
| E3 | HU-02 | CA-11 | `apps/api/test/jobs/status-rules.test.ts:74` |
| E4 | HU-02 | CA-12 | `apps/api/test/jobs/status-rules.test.ts:117` |
| P (FEAT-04) | — (pendiente) | | |
| A2 (FEAT-04) | — (pendiente) | | |
| A3 (FEAT-04) | — (pendiente) | | |
| E5 (FEAT-04) | — (pendiente) | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
