---
id: UC-14
titulo: "Inscribir un candidato en una oferta"
modulo: inscripciones
actor: reclutador
estado: implementado
feature: FEAT-04
hus: [HU-04, HU-07, HU-09]
---

# UC-14 — Inscribir un candidato en una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador mete a un candidato en el proceso de selección de una oferta publicada, que empieza en la etapa
`received`.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Inscribir candidato» en el pipeline de la oferta (S-19).

## Precondiciones
- La oferta existe y está `published` (RV-17).
- El candidato existe.
- No existe ninguna inscripción de ese candidato en esa oferta (RV-18).

## Flujo principal (P)
1. El reclutador, desde el pipeline de la oferta, busca al candidato por nombre o email (RV-14) y elige uno; se
   inscribe un candidato cada vez (S-19).
2. El sistema comprueba que la oferta está `published` (RV-17) y que la pareja candidato-oferta no tiene inscripción
   (RV-18).
3. El sistema crea la `Application` en la etapa `received` (RV-19) y registra un `StageChange` sin origen →
   `received` con la fecha en UTC (S-13, RV-21, RV-25).
4. En la misma transacción, el sistema pide a `candidatos` que recalcule la retención del candidato: mientras tenga
   alguna inscripción no final, no hay fecha de fin (S-06, RGPD §3).
5. El pipeline muestra la inscripción en la columna «recibida» con el nombre del candidato (S-18).

## Flujos alternativos
_Ninguno._

## Excepciones
- **E1 — Oferta no publicada** (en el paso 2): la oferta está en `draft` o `closed` → error con un mensaje que lo
  explica, con 409 (decisión de la persona en la validación de FEAT-03, 2026-10-06); no se crea ni la
  `Application` ni el `StageChange` (RV-17).
- **E2 — Inscripción duplicada** (en el paso 2): la pareja ya tiene inscripción, en cualquier etapa (también
  `rejected`) → 409 con el ID de la inscripción existente; no se crea nada (RV-18, S-14).
- **E3 — Oferta o candidato inexistente** (en el paso 2): → 404 sin datos personales en el mensaje; no se crea nada
  (RGPD §6.1).
- **E4 — Petición mal formada** (en el paso 2): falta el candidato, el ID no es válido o llega un campo desconocido →
  400 en el envelope de error; no se crea nada (S-03, DEC-01).
- **E5 — Falla una escritura** (en los pasos 3-4): la transacción se deshace entera: no queda inscripción, ni
  `StageChange`, ni retención recalculada (S-06).
- **E6 — Candidato anonimizado** (FEAT-04 · pendiente) (en el paso 2): el candidato está anonimizado → 409 con un mensaje que lo explica, sin
  datos personales; no se crea nada (RV-17, FEAT-04 RN-11, DEC-07). El buscador del paso 1 no lo ofrece
  ([UC-11](../../candidatos/casos-de-uso/UC-11-buscar-candidatos.md) · A5).
- **E7 — Retención vencida sin anonimizar** (FEAT-04 · pendiente) (en el paso 2): el candidato no está anonimizado y su fecha de fin es igual
  o anterior a hoy en Europe/Madrid → 409 con un mensaje que lo explica; no se crea nada ni se recalcula la retención.
  Se podrá inscribir tras registrar un consentimiento nuevo (FEAT-04 RN-18 y RN-19; ratificada el 2026-10-13,
  FEAT-04 PA-03).

## Reglas de negocio
- RN-01: solo se inscribe en ofertas `published`.
- RN-02: una sola inscripción por candidato y oferta, para siempre.
- RN-03: toda inscripción nace en `received` con su `StageChange` inicial.
- RN-10: crear o cerrar una inscripción recalcula la retención del candidato en la misma transacción.

## Postcondiciones
- **Éxito:** existe una `Application` en `received` con un `StageChange` inicial, y el candidato no tiene fecha de
  fin de retención mientras siga abierta.
- **Fallo:** no se crea ninguna inscripción ni `StageChange`, y la retención del candidato no cambia.

## Datos personales
Vincula el ID del candidato a la oferta. Base jurídica: medidas precontractuales (art. 6.1.b) mientras la inscripción
esté abierta (RGPD §2). La búsqueda del paso 1 lee nombre y email (RV-14); las respuestas y los errores no devuelven
más datos de los necesarios (RGPD §6).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-04 | CA-01, CA-02, CA-03 | `apps/api/test/applications/enroll.test.ts:58`, `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:90`, `e2e/applications.spec.ts:63` |
| E1 | HU-04 | CA-04, CA-05 | `apps/api/test/applications/enroll.test.ts:90`, `apps/api/test/applications/enroll-adversarial.test.ts:245`, `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:157` |
| E2 | HU-04 | CA-06, CA-07, CA-08 | `apps/api/test/applications/enroll.test.ts:126`, `apps/api/test/applications/enroll-adversarial.test.ts:220`, `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:126`, `e2e/applications.spec.ts:81` |
| E3 | HU-04 | CA-09 | `apps/api/test/applications/enroll.test.ts:174` |
| E4 | HU-04 | CA-10 | `apps/api/test/applications/enroll-adversarial.test.ts:90` |
| E5 | HU-04 | CA-11 | `apps/api/test/applications/enroll-failures-adversarial.test.ts:86` |
| E6 | HU-07 | CA-16 | pendiente |
| E7 | — (FEAT-04 · pendiente) | | pendiente |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
