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

## 3. Retención

| Situación | Plazo de conservación (supuesto) | Al vencer |
|---|---|---|
| Con inscripción abierta | Mientras dure el proceso | — |
| Proceso cerrado, **sin** consentimiento para futuros procesos | 6 meses desde el cierre del último proceso | Anonimizar |
| Con consentimiento para futuros procesos | 24 meses desde la fecha del consentimiento | Anonimizar, salvo que lo renueve |

- `Candidate` guarda la **fecha de fin de retención**; se recalcula cuando cambia el consentimiento o se cierra su
  último proceso.
- El vencimiento es **por día**: un candidato vence el mismo día de su fecha de fin de retención (caso límite típico).

## 4. Derechos del candidato

| Derecho | Qué hace el ATS |
|---|---|
| Acceso (art. 15) | El reclutador puede exportar la ficha completa del candidato con sus inscripciones e historial |
| Rectificación (art. 16) | Edición de la ficha |
| **Supresión (art. 17)** | **Anonimización a petición** (ver §5) |
| Oposición y retirada del consentimiento (arts. 7.3 y 21) | Se retira el consentimiento y se recalcula la retención |

## 5. Supresión mediante anonimización

Suprimir no borra filas: **anonimiza** al candidato para no romper las estadísticas de las ofertas.

- Se sustituyen por valores neutros: nombre («Candidato anonimizado»), email, teléfono, resumen y skills.
- Se conservan: el ID, las inscripciones con su etapa y el historial de cambios de etapa, sin texto libre que pueda
  identificar a la persona.
- Queda registrado **cuándo** se anonimizó y **por qué** (petición o vencimiento), sin guardar los datos borrados.
- Es **irreversible** e **idempotente**: anonimizar dos veces no falla ni cambia nada.
- Un candidato anonimizado no aparece en búsquedas ni puede inscribirse en ofertas nuevas.

## 6. Reglas técnicas que vigila el auditor

1. **Nada de datos personales en logs, mensajes de error ni respuestas que no los necesitan** (los logs de Fastify no
   registran cuerpos de petición).
2. **Minimización** en las respuestas: un listado devuelve lo justo para la lista, no la ficha entera.
3. **Seeds, fixtures y tests con datos inventados**; nunca CVs ni personas reales.
4. **Toda feature que toque datos de candidatos** declara en su PRD qué datos, para qué y cuánto tiempo.
5. **Exportaciones e importaciones** (CSV) validan y no dejan copias temporales con datos personales.
