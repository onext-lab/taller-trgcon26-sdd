# RGPD en el ATS — EJEMPLO DIDÁCTICO

> **⚠️ EJEMPLO DIDÁCTICO.** Este documento es material del taller de SDD: describe cómo trataría un ATS **ficticio**
> los datos personales de sus candidatos, para que las features y los auditores tengan reglas concretas que cumplir.
> **No es asesoría jurídica** ni sustituye el análisis de un delegado de protección de datos. Los plazos y las bases
> jurídicas son supuestos razonables elegidos para el ejemplo. Todos los datos del repo son inventados.

Es la base de la **feature A (supresión y retención)** y la referencia del agente `datos-personales-auditor`.

## 1. Qué datos tratamos

| Dato | Entidad | ¿Necesario? | Para qué |
|---|---|---|---|
| Nombre y apellidos | `Candidate` | Sí | Identificar al candidato en el proceso |
| Email | `Candidate` | Sí | Contactar; detectar duplicados |
| Teléfono | `Candidate` | No (opcional) | Contactar si el candidato lo prefiere |
| Resumen profesional y skills | `Candidate` | Sí | Valorar la adecuación a una oferta |
| Consentimiento (fecha y alcance) | `Candidate` | Sí | Acreditar la base jurídica de la conservación |
| Fecha de fin de retención | `Candidate` | Sí | Saber cuándo hay que suprimir |
| Inscripciones y cambios de etapa | `Application`, `StageChange` | Sí | Seguir el proceso de selección |

**No se recogen**: fecha de nacimiento, foto, estado civil, nacionalidad, ni ningún dato de categoría especial (salud,
origen, religión, afiliación…). Un PRD que quiera añadir un dato nuevo tiene que justificar para qué lo necesita
(**minimización**) y la review lo comprueba.

## 2. Base jurídica (supuesto del ejemplo)

- **Proceso de selección en curso**: medidas precontractuales a petición del interesado (art. 6.1.b RGPD) mientras
  tenga alguna inscripción abierta.
- **Conservación para futuros procesos**: **consentimiento** explícito del candidato (art. 6.1.a), registrado con fecha
  y alcance. Sin consentimiento, al cerrarse su último proceso empieza a contar la retención corta.
- **Prueba del consentimiento (art. 7.1)**: la ficha guarda la fecha y la **versión** del texto (`v1`). El texto de cada
  versión `vN` se conserva en el repositorio (`apps/web/src/features/candidates/consent.ts` y su historial de git);
  cambiar el texto obliga a subir la versión, nunca a reescribir la anterior.

## 3. Retención

| Situación | Plazo de conservación (supuesto) | Al vencer |
|---|---|---|
| Con inscripción abierta | Mientras dure el proceso | — |
| Proceso cerrado, **sin** consentimiento para futuros procesos | 6 meses desde el cierre del último proceso | Anonimizar |
| Con consentimiento para futuros procesos | 24 meses desde la fecha del consentimiento | Anonimizar, salvo que lo renueve |
| **Sin** ninguna inscripción y **sin** consentimiento | 6 meses desde el alta | Anonimizar |

- `Candidate` guarda la **fecha de fin de retención**. Se recalcula al crear o cerrar una inscripción y al cambiar el
  consentimiento, en la misma transacción que la operación que lo provoca.
- **Fórmula única** (validada en el shaping, `S-06` de
  [reglas-validadas.md](02_discovery/reglas-validadas.md)): con alguna inscripción no final, **sin fecha de fin**; si
  no, la **más tardía** de las que apliquen: consentimiento vigente + 24 meses; cierre del último proceso + 6 meses;
  alta + 6 meses si nunca tuvo inscripciones. `hired` también cierra el proceso. Retirar el consentimiento aplica la
  fórmula aunque la fecha resultante ya haya pasado (se anonimiza en la siguiente pasada). Si la fecha no existe
  (31/08 + 6 meses), se toma el último día del mes.
- El vencimiento es **por día**: un candidato vence el mismo día de su fecha de fin de retención (caso límite típico).

## 4. Derechos del candidato

| Derecho | Qué hace el ATS |
|---|---|
| Acceso (art. 15) | El reclutador puede exportar la ficha completa del candidato con sus inscripciones e historial |
| Rectificación (art. 16) | Edición de la ficha |
| **Supresión (art. 17)** | **Anonimización a petición** (ver §5) |
| Retirada del consentimiento (art. 7.3) | Se retira el consentimiento y se recalcula la retención |

El derecho de oposición (art. 21) no aparece en la tabla porque solo cabe frente a tratamientos basados en interés
público o interés legítimo (art. 6.1.e y 6.1.f), y este ejemplo usa medidas precontractuales (6.1.b) y consentimiento
(6.1.a). Si una feature introdujera un tratamiento por interés legítimo, habría que añadirlo.

## 5. Supresión mediante anonimización

Suprimir no borra filas: **anonimiza** al candidato para no romper las estadísticas de las ofertas.

- Se sustituyen por valores neutros: nombre («Candidato anonimizado»), email, teléfono, resumen y skills.
- Se conservan: el ID, las inscripciones con su etapa y el historial de cambios de etapa, sin texto libre que pueda
  identificar a la persona.
- Queda registrado **cuándo** se anonimizó y **por qué** (petición o vencimiento), sin guardar los datos borrados.
- Es **irreversible** e **idempotente**: anonimizar dos veces no falla ni cambia nada.
- Un candidato anonimizado no aparece en búsquedas ni puede inscribirse en ofertas nuevas.

## 6. Reglas técnicas que vigila el auditor

1. **Nada de datos personales en logs, mensajes de error ni respuestas que no los necesitan.** Los logs de Fastify no
   registran cuerpos de petición, y el serializador de `apps/api/src/logger.ts` quita la query de la URL (`?q=` puede
   llevar un nombre o un email) y la IP de origen; lo comprueba `apps/api/test/logger.test.ts`.
2. **Minimización** en las respuestas: un listado devuelve lo justo para la lista, no la ficha entera.
3. **Seeds, fixtures y tests con datos inventados**; nunca CVs ni personas reales. Emails en `example.com` o
   `example.org`; teléfonos de ficción de la serie `+34 600 000 0xx`.
4. **Toda feature que toque datos de candidatos** declara en su PRD qué datos, para qué y cuánto tiempo.
5. **Exportaciones e importaciones** (CSV) validan y no dejan copias temporales con datos personales.

## 7. Cuestiones abiertas para la feature A (supresión y retención)

Salen de la review de HU-04 (`docs/03_delivery/hu/HU-04-inscribir-candidato/review/REVIEW.md` §4 y §9). Se dejan
abiertas a propósito para el *shaping* de la feature A.

1. **¿Se puede inscribir, o encontrar en el buscador, a un candidato con la retención vencida que aún no se ha
   anonimizado?** Hoy sí: al inscribirlo su retención pasa a «mientras dure el proceso» (DT-06 del PRD de HU-04; lo fija
   `apps/api/test/applications/enroll-retention.test.ts`). La duda es si eso prolonga la conservación sin una base
   jurídica nueva, y si listados y búsquedas deben ocultar a los vencidos (§5 solo excluye a los anonimizados).
2. **Marca de anonimizado en los puertos.** Aún no existe ninguna columna ni estado de anonimizado. Cuando exista, los
   puertos que `inscripciones` usa para leer candidatos (`exists` y `findNames`) tendrán que rechazar o rotular a los
   anonimizados, y el pipeline mostrará «Candidato anonimizado».
3. **¿La anonimización vacía siempre la nota libre del rechazo?** El historial es inmutable salvo `SET note = NULL`
   (DT-12 del PRD de HU-04, `apps/api/src/db/migrations/003-create-applications.sql`), pensado para esto. Falta decidir
   si se vacía en toda anonimización (por petición y por vencimiento).
