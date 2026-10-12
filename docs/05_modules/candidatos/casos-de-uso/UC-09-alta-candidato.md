---
id: UC-09
titulo: "Dar de alta un candidato"
modulo: candidatos
actor: reclutador
estado: implementado
feature: FEAT-04
hus: [HU-03]
---

# UC-09 — Dar de alta un candidato

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador registra a un candidato con sus datos de contacto, su resumen y sus skills para poder inscribirlo en
ofertas, y el sistema le asigna su fecha de fin de retención.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Nuevo candidato».

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador rellena nombre y apellidos (un solo campo) y email; opcionalmente, teléfono, resumen y skills. La
   casilla de consentimiento para futuros procesos aparece desmarcada (RV-09, RV-11, S-03).
2. El reclutador envía el formulario.
3. El sistema recorta los espacios, valida los campos (RV-09, S-03), guarda el email en minúsculas (RV-10) y
   normaliza las skills: recortadas, en minúsculas, sin vacías y sin repetir (RV-09, S-03).
4. El sistema calcula la fecha de fin de retención: alta + 6 meses, por día natural en Europe/Madrid (RV-13, RV-25,
   S-06).
5. El sistema guarda el candidato y su retención en una sola transacción y muestra su ficha (UC-12).

## Flujos alternativos
- **A1 — Con consentimiento** (desde el paso 1): el reclutador marca la casilla, declarando que el candidato lo dio →
  en el paso 4 el sistema guarda la fecha (la pone el sistema) y la versión del texto (constante del código, mostrada
  junto a la casilla), y la retención es la más tardía de las aplicables: fecha del consentimiento + 24 meses
  (RV-11, S-06, S-07). Continúa en el paso 5.

## Excepciones
- **E1 — Datos inválidos** (en el paso 3): falta un obligatorio, un campo está fuera de límites o de formato, o llega
  un campo desconocido o de solo lectura (p. ej., el fin de retención) → 400 en el envelope con el error junto a cada
  campo; no se guarda nada y el formulario conserva lo escrito (RV-09, RV-12, S-03, DEC-01).
- **E2 — Email duplicado** (en el paso 3): ya existe un candidato con el mismo email sin distinguir mayúsculas → 409
  con el ID del candidato existente, sin repetir el email en el mensaje; no se guarda nada (RV-10, RGPD §6).
- **E3 — Fallo al guardar** (en el paso 5): la base de datos no responde o está ocupada → error en el envelope sin
  datos personales; no queda nada a medias y el formulario conserva lo escrito (DEC-01, QUALITY-GATES §3).
- **E4 — Email del dominio reservado a los anonimizados** (en el paso 3): el email pertenece al dominio reservado para
  los emails anonimizados → 400 junto al campo; no se guarda nada (FEAT-04 RN-03).

## Reglas de negocio
- RN-01 campos y límites; RN-02 normalización de texto y esquema estricto; RN-03 email único; RN-04 skills; RN-05
  consentimiento; RN-06 retención calculada por el sistema; RN-07 fórmula de retención; RN-09 fechas.

## Postcondiciones
- **Éxito:** existe un candidato nuevo con email normalizado, skills normalizadas, consentimiento (si se marcó, con
  fecha y versión) y fecha de fin de retención.
- **Fallo:** no existe ningún candidato nuevo ni se ha modificado ninguno.

## Datos personales
Escribe nombre y apellidos, email, teléfono, resumen, skills, consentimiento y fin de retención (RGPD §1). Base
jurídica: medidas precontractuales y, si se marca, consentimiento (RGPD §2); conservación según RGPD §3.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-03 | CA-01, CA-02 | `apps/api/test/candidates/create.test.ts:37`, `e2e/candidates.spec.ts:108` |
| A1 | HU-03 | CA-03 | `apps/api/test/candidates/create.test.ts:60`, `apps/web/test/features/candidates/CandidateFormScreen.test.tsx:118` |
| E1 | HU-03 | CA-04, CA-32 | `apps/api/test/candidates/create-adversarial.test.ts:113`, `apps/web/test/features/candidates/CandidateFormScreen.test.tsx:156` |
| E2 | HU-03 | CA-05, CA-32 | `apps/api/test/candidates/create-adversarial.test.ts:173`, `apps/web/test/features/candidates/CandidateFormScreen.adversarial.test.tsx:102`, `e2e/candidates.spec.ts:163` |
| E3 | HU-03 | CA-06, CA-32 | `apps/api/test/candidates/create-adversarial.test.ts:196`, `apps/web/test/features/candidates/CandidateFormScreen.test.tsx:187` |
| E4 | — (FEAT-04) | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
